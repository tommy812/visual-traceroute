import os
import re
import json
import socket
import threading
import psycopg2
import subprocess
import ipaddress
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from traceroute_parser import parse_traceroute6

# -------- Configuration --------
DESTINATIONS_FILE = "destinations.txt"
OUTPUT_ROOT = "results"

# Agreed parameters for ALL methods (-m 30 -q 2 -w 6)
MAX_HOPS = 30          # -m
QUERIES_PER_HOP = 2    # -q
PER_PROBE_WAIT = 6     # -w
CONCURRENCY = 6        # destinations processed in parallel
CONSEC_TIMEOUT_CUTOFF = 6  # early abort after this many full-timeout hops (after last responsive)
PER_METHOD_TIMEOUT = 550   # subprocess wall clock cap (seconds)
# --------------------------------

TRACEROUTE_METHODS = [
    {
        "name": "Traceroute",
        "command": "traceroute6",
        "args": [],
        "description": "Classic IPv6 traceroute",
        "version": None,
        "parameters": {
            "timeout": PER_METHOD_TIMEOUT,
            "max_hops": MAX_HOPS,
            "queries_per_hop": QUERIES_PER_HOP,
            "per_probe_wait": PER_PROBE_WAIT,
            "probe_type": "UDP"
        }
    },
    {
        "name": "Traceroute ICMP",
        "command": "traceroute6",
        "args": ["-I"],
        "description": "IPv6 traceroute using ICMP Echo (-I)",
        "version": None,
        "parameters": {
            "timeout": PER_METHOD_TIMEOUT,
            "max_hops": MAX_HOPS,
            "queries_per_hop": QUERIES_PER_HOP,
            "per_probe_wait": PER_PROBE_WAIT,
            "probe_type": "ICMP"
        }
    },
    {
        "name": "TCPtraceroute",
        "command": "tcptraceroute6",
        "args": [],
        "description": "TCP-based IPv6 traceroute",
        "version": None,
        "parameters": {
            "timeout": PER_METHOD_TIMEOUT,
            "max_hops": MAX_HOPS,
            "queries_per_hop": QUERIES_PER_HOP,
            "per_probe_wait": PER_PROBE_WAIT,
            "port": 80,
            "probe_type": "TCP"
        }
    },
]

# ---- DB env ----
DB_HOST = os.getenv("DB_HOST", "db.afruhqkwfcxvndzbrlga.supabase.co")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Cambridge8120!Milano123!")
# ----------------

HEADER_RE = re.compile(r"(?:traceroute|tcptraceroute)\s+to\s+([^\s(]+)\s*\(([0-9A-Fa-f:.]+)\)", re.IGNORECASE)
HOP_LINE_RE = re.compile(r"^\s*(\d+)\s+(.+)$")

lock_print = threading.Lock()

def safe_print(*a, **k):
    with lock_print:
        print(*a, **k)

def save_json(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

def parse_header_domain_ip(first_line: str):
    if not first_line:
        return None, None
    m = HEADER_RE.search(first_line.strip())
    if m:
        return m.group(1).lower(), m.group(2).lower()
    return None, None

def resolve_domain_ipv6(domain: str):
    try:
        infos = socket.getaddrinfo(domain, None, socket.AF_INET6)
        for fam, _, _, _, sockaddr in infos:
            if fam == socket.AF_INET6:
                return sockaddr[0]
    except Exception:
        return None
    return None

def get_or_create_method(cur, name, version=None, description=None) -> int:
    cur.execute("""
        INSERT INTO traceroute_methods (name, version, description)
        VALUES (%s, %s, %s)
        ON CONFLICT (name) DO UPDATE
            SET description = EXCLUDED.description,
                version = EXCLUDED.version
        RETURNING id
    """, (name, version, description))
    return cur.fetchone()[0]

def get_or_create_domain_id(cur, domain: str) -> int:
    name = (domain or "").strip().lower() or "unknown"
    cur.execute("""
        INSERT INTO domains (name)
        VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name
        RETURNING id
    """, (name,))
    return cur.fetchone()[0]

def get_or_create_destination_id(cur, domain_id: int, ip: str) -> int:
    cur.execute("""
        INSERT INTO destinations (domain_id, address)
        VALUES (%s, %s::inet)
        ON CONFLICT (domain_id, address) DO UPDATE SET address=EXCLUDED.address
        RETURNING id
    """, (domain_id, ip))
    return cur.fetchone()[0]

def upload_to_supabase(result, raw_output, method_def, effective_params):
    domain, ip = result.get("domain"), result.get("ip")
    first_line = raw_output.splitlines()[0] if raw_output else ""
    parsed_domain, parsed_ip = parse_header_domain_ip(first_line)

    if not ip:
        ip = parsed_ip or resolve_domain_ipv6(domain)
        if not ip:
            safe_print(f"❌ No IP (header+DNS failed) {domain}")
            return

    domain_eff = (parsed_domain or domain or ip).lower()

    conn = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
            host=DB_HOST, port=DB_PORT, sslmode="require"
        )
        cur = conn.cursor()

        method_id = get_or_create_method(cur, method_def["name"],
                                         method_def.get("version"),
                                         method_def.get("description"))

        domain_id = get_or_create_domain_id(cur, domain_eff)
        destination_id = get_or_create_destination_id(cur, domain_id, ip)

        cur.execute("""
            INSERT INTO trace_runs
              (timestamp, destination_id, method_id, raw_output, parameters, error)
            VALUES
              (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            result["timestamp"], destination_id, method_id,
            raw_output,
            json.dumps(effective_params),
            result.get("error")
        ))
        trace_run_id = cur.fetchone()[0]

        for hop in result["hops"]:
            rtts = hop.get("rtt_ms") or [None, None, None]
            cur.execute("""
                INSERT INTO hops
                  (trace_run_id, hop_number, ip, hostname, rtt1, rtt2, rtt3, extra)
                VALUES
                  (%s, %s, %s::inet, %s, %s, %s, %s, %s)
            """, (
                trace_run_id,
                hop.get("hop"),
                hop.get("ip"),
                hop.get("hostname"),
                rtts[0], rtts[1], rtts[2],
                json.dumps(hop.get("extra") or {})
            ))

        conn.commit()
        cur.close(); conn.close()
        safe_print(f"✅ Uploaded: {method_def['name']} {domain_eff} ({ip}) run_id={trace_run_id}")
    except Exception as e:
        if conn:
            conn.rollback(); conn.close()
        safe_print("❌ DB upload failed:", e)

def build_command(method, target):
    params = method["parameters"]
    pre = list(method.get("args") or [])
    pre += ["-m", str(params["max_hops"])]
    pre += ["-q", str(params["queries_per_hop"])]
    pre += ["-w", str(params["per_probe_wait"])]
    cmd = [method["command"], *pre, target]
    post = []
    if method["name"] == "TCPtraceroute":
        post.append(str(params.get("port", 80)))
    return cmd + post

def run_with_early_stop(method, target_ip_or_host):
    """
    Stream process, early stop on:
      - Destination IP observed in hop line
      - CONSEC_TIMEOUT_CUTOFF full-timeout hops AFTER last responsive hop
    Returns (raw_output, early_reason or None)
    """
    cmd = build_command(method, target_ip_or_host)
    timeout = method["parameters"]["timeout"]
    dest_ip = None
    raw_lines = []
    early_reason = None
    consecutive_full_timeouts = 0
    last_responsive_hop = 0

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
    except FileNotFoundError:
        return "", f"Command not found: {cmd[0]}"

    try:
        for line in proc.stdout:
            raw_lines.append(line)
            if dest_ip is None and HEADER_RE.search(line):
                _, dest_ip = parse_header_domain_ip(line)

            # Hop analysis
            m = HOP_LINE_RE.match(line)
            if m:
                hop_no = int(m.group(1))
                hop_body = m.group(2)
                # Destination reached?
                if dest_ip and dest_ip in hop_body:
                    early_reason = "destination_reached"
                    proc.terminate()
                    break
                # Determine if full-timeout hop (all probes '*')
                # Heuristic: contains at least one '*' and no ' ms'
                if hop_body.count('*') > 0 and (" ms" not in hop_body):
                    # full timeout
                    if hop_no > last_responsive_hop:
                        consecutive_full_timeouts += 1
                else:
                    last_responsive_hop = hop_no
                    consecutive_full_timeouts = 0
                if (last_responsive_hop > 0 and
                        consecutive_full_timeouts >= CONSEC_TIMEOUT_CUTOFF):
                    early_reason = f"cutoff_{CONSEC_TIMEOUT_CUTOFF}_timeouts"
                    proc.terminate()
                    break
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    except Exception as e:
        early_reason = f"stream_error:{e}"

    raw_output = "".join(raw_lines)

    # If still running beyond our PER_METHOD_TIMEOUT, kill (safeguard)
    # (We rely on outer wall clock by subprocess timeout not here; left as is)
    return raw_output, early_reason

def process_destination(domain, ip, timestamp, date_str):
    target_display = f"{domain}" if domain else ip
    resolved_ip = ip
    if not resolved_ip and domain and ":" not in domain:
        # Resolve upfront to know destination for early stop (best-effort)
        resolved_ip = resolve_domain_ipv6(domain)

    for method in TRACEROUTE_METHODS:
        safe_print(f"[{target_display}] Running {method['name']}...")
        raw_output, early_reason = run_with_early_stop(method, resolved_ip or domain)
        error_msg = None
        if early_reason:
            error_msg = f"early_stop:{early_reason}"
            safe_print(f"[{target_display}] ⏹ Early stop: {early_reason} ({method['name']})")
        if not raw_output.strip():
            error_msg = (error_msg + "|empty_output") if error_msg else "empty_output"
            safe_print(f"[{target_display}] ⚠️ Empty output ({method['name']})")

        hops = parse_traceroute6(raw_output)
        result = {
            "timestamp": timestamp,
            "domain": domain,
            "ip": ip,
            "hops": hops,
            "error": error_msg
        }
        safe = (domain if domain else (ip or "unknown")).replace(".", "_").replace(":", "_")
        out_path = os.path.join(
            OUTPUT_ROOT,
            date_str,
            f"{method['name'].replace(' ','_')}_{safe}_{timestamp.replace(':','').replace('.','')}.json"
        )
        save_json(result, out_path)
        safe_print(f"[{target_display}] 💾 Saved {method['name']} -> {out_path}")
        upload_to_supabase(result, raw_output, method, method["parameters"])

def load_targets():
    targets = []
    seen = set()
    with open(DESTINATIONS_FILE) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            # Strip inline comments
            if "#" in line:
                line = line.split("#", 1)[0].strip()
                if not line:
                    continue
            parts = line.split()
            if not parts:
                continue

            domain = parts[0].strip()

            # Fix common typo wwww.*
            if domain.startswith("wwww."):
                domain = "www." + domain[5:]

            # Specific known correction
            if domain == "gov.co.uk":
                domain = "gov.uk"

            ipv6 = None
            if len(parts) > 1:
                cand = parts[1].strip()
                # Only accept if true IPv6 literal
                try:
                    ipaddress.IPv6Address(cand)
                    ipv6 = cand
                except ValueError:
                    ipv6 = None  # ignore descriptor

            key = (domain.lower(), ipv6)
            if key in seen:
                continue
            seen.add(key)
            targets.append((domain, ipv6))
    return targets

def main():
    now = datetime.utcnow()
    timestamp = now.isoformat() + "Z"
    date_str = now.strftime("%Y-%m-%d")

    targets = load_targets()
    safe_print(f"Starting batch: {len(targets)} destinations, concurrency={CONCURRENCY}")
    os.makedirs(os.path.join(OUTPUT_ROOT, date_str), exist_ok=True)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = {
            ex.submit(process_destination, domain, ip, timestamp, date_str): (domain, ip)
            for domain, ip in targets
        }
        for fut in as_completed(futures):
            domain, ip = futures[fut]
            try:
                fut.result()
            except Exception as e:
                safe_print(f"[{domain or ip}] ❌ Worker error: {e}")

    safe_print("All done.")

if __name__ == "__main__":
    main()
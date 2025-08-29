#Backup of version working with executor, no parallel
import os
import re
import json
import socket
from datetime import datetime
import psycopg2

from traceroute_executor import run_traceroute
from traceroute_parser import parse_traceroute6

DESTINATIONS_FILE = "destinations.txt"
OUTPUT_ROOT = "results"
MAX_COMMAND_TIMEOUT = 550  # Hard cap on any single traceroute execution (seconds)

TRACEROUTE_METHODS = [
    {
        "name": "Traceroute",
        "command": "traceroute6",
        "args": [],
        "description": "Classic IPv6 traceroute",
        "version": None,
        # Unified parameters
        "parameters": {
            "timeout": 550,          # overall wall-clock cap (will be clamped)
            "max_hops": 30,          # -m
            "queries_per_hop": 3,    # -q
            "per_probe_wait": 6,     # -w (seconds to wait for each probe reply)
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
            "timeout": 550,
            "max_hops": 30,
            "queries_per_hop": 3,
            "per_probe_wait": 6,
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
            "timeout": 550,
            "max_hops": 30,
            "queries_per_hop": 3,
            "per_probe_wait": 6,
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

def save_json(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

def parse_header_domain_ip(raw_output: str):
    if not raw_output:
        return None, None
    first = raw_output.splitlines()[0].strip()
    m = HEADER_RE.search(first)
    if m:
        return m.group(1).strip().lower(), m.group(2).strip().lower()
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
        SELECT id FROM traceroute_methods
        WHERE name=%s AND (version=%s OR (version IS NULL AND %s IS NULL))
    """, (name, version, version))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""
        INSERT INTO traceroute_methods (name, version, description)
        VALUES (%s, %s, %s) RETURNING id
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

def upload_to_supabase(result, raw_output, method_def):
    domain, ip = result.get("domain"), result.get("ip")
    parsed_domain, parsed_ip = parse_header_domain_ip(raw_output)

    if ip is None:
        ip = parsed_ip or resolve_domain_ipv6(domain)
        if not ip:
            first_line = raw_output.splitlines()[0] if raw_output else "<no output>"
            print(f"❌ No IP (header + DNS failed); skipping. First line: {first_line}")
            return

    domain_eff = (parsed_domain or domain or ip).lower()

    conn = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
            host=DB_HOST, port=DB_PORT, sslmode="require",
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
            json.dumps(method_def.get("parameters")) if method_def.get("parameters") else None,
            result.get("error"),
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
                json.dumps(hop.get("extra") or {}),
            ))

        conn.commit()
        cur.close(); conn.close()
        print(f"✅ Uploaded: {method_def['name']} {domain_eff} ({ip}) run_id={trace_run_id}")
    except Exception as e:
        if conn:
            conn.rollback(); conn.close()
        print("❌ DB upload failed:", e)

def main():
    now = datetime.utcnow()
    timestamp = now.isoformat() + "Z"
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H%M%S")

    targets = []
    with open(DESTINATIONS_FILE) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) == 2:
                domain, ip = parts[0].strip(), parts[1].strip()
            elif len(parts) == 1:
                token = parts[0].strip()
                if ":" in token:
                    domain, ip = token, token
                else:
                    domain, ip = token, None
            else:
                print(f"⚠️ Skipping malformed line: {line}")
                continue
            targets.append((domain, ip))

    for domain, ip in targets:
        target = ip if ip is not None else domain
        for method in TRACEROUTE_METHODS:
            print(f"Running {method['name']} to {domain}{f' ({ip})' if ip else ''}...")

            params = method.get("parameters", {})
            pre_args = list(method.get("args") or [])

            # Apply unified flags: -m, -q, -w
            if params.get("max_hops") is not None:
                pre_args += ["-m", str(params["max_hops"])]
            if params.get("queries_per_hop") is not None:
                pre_args += ["-q", str(params["queries_per_hop"])]
            if params.get("per_probe_wait") is not None:
                pre_args += ["-w", str(params["per_probe_wait"])]

            post_args = None
            if method["name"] == "TCPtraceroute":
                port = params.get("port", 80)
                post_args = [str(port)]

            requested_timeout = params.get("timeout", MAX_COMMAND_TIMEOUT)
            effective_timeout = min(requested_timeout, MAX_COMMAND_TIMEOUT)

            output, error, rc, full_cmd = run_traceroute(
                method["command"],
                target,
                pre_args=pre_args,
                post_args=post_args,
                timeout=effective_timeout
            )

            if requested_timeout != effective_timeout:
                print(f"ℹ️ Timeout capped to {effective_timeout}s (requested {requested_timeout}s)")

            if error:
                print(f"⚠️ Command issue rc={rc} cmd={' '.join(full_cmd)} error={error}")

            hops = parse_traceroute6(output)
            result = {
                "timestamp": timestamp,
                "domain": domain,
                "ip": ip,
                "hops": hops,
                "error": error,
            }

            safe = (domain if domain else (ip or "unknown")).replace(".", "_").replace(":", "_")
            out_path = os.path.join(
                OUTPUT_ROOT,
                date_str,
                f"{method['name'].replace(' ','_')}_{safe}_{time_str}.json"
            )
            save_json(result, out_path)
            print(f"💾 Saved {method['name']} results to {out_path}")

            upload_to_supabase(result=result, raw_output=output, method_def=method)

if __name__ == "__main__":
    main()
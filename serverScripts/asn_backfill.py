#!/usr/bin/env python3
import os, sys, json, time, re
import requests, psycopg2

DB_HOST = os.getenv("DB_HOST", "db.afruhqkwfcxvndzbrlga.supabase.co")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Cambridge8120!Milano123!")
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN", "bad4aa081b2fd7")   # free Lite token

if not IPINFO_TOKEN:
    print("❌ Please set IPINFO_TOKEN")
    sys.exit(1)

BATCH_URL = f"https://ipinfo.io/batch?token={IPINFO_TOKEN}"
BATCH_SIZE = 1000

def parse_record(rec):
    """Return ASN integer from ipinfo lite response"""
    if not rec or "error" in rec:
        return None
    asn_str = rec.get("asn")
    if not asn_str or not asn_str.startswith("AS"):
        return None
    try:
        return int(asn_str[2:])
    except:
        return None

def main():
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT, sslmode="require"
    )
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT ip::text FROM hops WHERE ip IS NOT NULL AND asn IS NULL")
    ips = [r[0] for r in cur.fetchall()]
    print(f"Found {len(ips)} IPs missing ASN")

    session = requests.Session()
    headers = {"Content-Type": "application/json"}

    for i in range(0, len(ips), BATCH_SIZE):
        chunk = ips[i:i+BATCH_SIZE]
        print(f"Batch {i+1}-{i+len(chunk)}")
        try:
            r = session.post(BATCH_URL, headers=headers,
                             data=json.dumps(chunk), timeout=30)
            r.raise_for_status()
            results = r.json()
        except Exception as e:
            print("⚠️ error:", e)
            time.sleep(2)
            continue

        for ip in chunk:
            rec = results.get(ip)
            asn = parse_record(rec)
            if not asn:
                continue
            cur.execute("""
              UPDATE hops SET asn=%s
              WHERE ip=%s::inet AND asn IS NULL
            """, (asn, ip))

        conn.commit()

    cur.close(); conn.close()
    print("✅ Backfill complete")

if __name__ == "__main__":
    main()

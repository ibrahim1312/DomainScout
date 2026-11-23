"""Local outreach log; does not send messages."""
import argparse
import sqlite3
from datetime import datetime, timezone
from domainscout import analyze

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("action", choices=["add", "list"])
    p.add_argument("--db", default="outreach.db")
    p.add_argument("--domain")
    p.add_argument("--contact")
    p.add_argument("--status", choices=["planned", "contacted", "replied", "declined", "opted_out"], default="planned")
    a = p.parse_args()
    with sqlite3.connect(a.db) as db:
        db.execute("CREATE TABLE IF NOT EXISTS log (domain TEXT, contact TEXT, status TEXT, updated TEXT, PRIMARY KEY(domain,contact))")
        if a.action == "add":
            if not a.domain or not a.contact:
                p.error("--domain and --contact required")
            domain = analyze(a.domain)["domain"]
            contact = a.contact.strip().lower()
            old = db.execute("SELECT status FROM log WHERE domain=? AND contact=?", (domain, contact)).fetchone()
            if old and old[0] == "opted_out" and a.status != "opted_out":
                p.error("Contact opted out")
            db.execute("INSERT OR REPLACE INTO log VALUES (?,?,?,?)", (domain, contact, a.status, datetime.now(timezone.utc).isoformat()))
        else:
            for row in db.execute("SELECT * FROM log ORDER BY updated DESC"):
                print(*row, sep=" | ")

if __name__ == "__main__":
    main()

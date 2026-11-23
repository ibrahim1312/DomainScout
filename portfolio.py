"""Analyze a CSV portfolio with a domain column."""
import csv
import argparse
import json
from domainscout import analyze

def portfolio(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = csv.DictReader(f)
        if "domain" not in (rows.fieldnames or []):
            raise ValueError("CSV requires a domain column")
        for row in rows:
            try:
                yield analyze(row["domain"])
            except ValueError as exc:
                yield {"domain": row["domain"], "error": str(exc)}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    print(json.dumps(list(portfolio(p.parse_args().csv)), indent=2))

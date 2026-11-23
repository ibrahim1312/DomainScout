"""Rank user-supplied business prospects by lexical similarity, not purchase intent."""
import argparse
import csv
import json
import re
from difflib import SequenceMatcher
from domainscout import analyze

def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())

def rank(domain, rows):
    target = normalize(analyze(domain)["domain"].split(".")[0])
    results = []
    for row in rows:
        name = normalize(row["name"])
        score = SequenceMatcher(None, target, name).ratio()
        results.append({**row, "lexical_similarity": round(score, 3)})
    return sorted(results, key=lambda r: r["lexical_similarity"], reverse=True)

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("domain")
    p.add_argument("csv")
    args = p.parse_args()
    with open(args.csv, encoding="utf-8-sig", newline="") as f:
        print(json.dumps(rank(args.domain, csv.DictReader(f)), indent=2))

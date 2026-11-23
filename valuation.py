"""Heuristic domain quality score, not a monetary appraisal."""
import argparse
import json
from domainscout import analyze

def evaluate(domain):
    info = analyze(domain)
    label = info["domain"].split(".")[0]
    n = len(label)
    parts = {
        "length": 30 if n <= 6 else 25 if n <= 10 else 18 if n <= 15 else 8 if n <= 22 else 2,
        "extension": {"com": 25, "org": 17, "net": 16, "io": 16, "ai": 16}.get(info["extension"], 10),
        "no_hyphen": 15 if "-" not in label else 0,
        "no_digits": 15 if not info["contains_digits"] else 0,
        "ascii_letters": 15 if label.isascii() and label.isalpha() else 0,
    }
    score = sum(parts.values())
    return {"domain": info["domain"], "quality_score": score, "max_score": 100,
            "breakdown": parts, "market_value": None,
            "note": "Subjective lexical heuristic, not a sale-price estimate. Comparable sales, buyer demand, trademarks, traffic and registration costs require independent research."}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("domains", nargs="+")
    print(json.dumps([evaluate(d) for d in p.parse_args().domains], indent=2))

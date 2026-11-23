"""Market evidence report using user-supplied, independently verified data."""
import argparse
import csv
import json
import math
import statistics
from valuation import evaluate
from domainscout import analyze

def report(domain, sales, buyers, monthly_searches=None, cpc=None):
    target = analyze(domain)
    label = target["domain"].split(".")[0]
    comparable = []
    for row in sales:
        info = analyze(row["domain"])
        price = float(row["price_usd"])
        if not math.isfinite(price) or price <= 0:
            continue
        if info["extension"] == target["extension"] and abs(info["first_label_length"] - len(label)) <= 3 and row.get("source", "").strip():
            comparable.append({"domain": info["domain"], "price_usd": price, "source": row["source"], "date": row.get("date")})
    unique = {}
    for row in comparable:
        unique[(row["domain"], row["date"])] = row
    comparable = list(unique.values())
    prices = sorted(r["price_usd"] for r in comparable)
    buyer_sites = sorted({r["website"].strip().lower().rstrip("/") for r in buyers if r.get("website", "").strip()})
    result = evaluate(domain)
    result.update({"comparable_sales": comparable, "comparable_count": len(prices),
                   "candidate_buyer_count": len(buyer_sites), "monthly_searches": monthly_searches,
                   "cost_per_click_usd": cpc,
                   "search_commercial_proxy_usd": round(monthly_searches*cpc, 2) if monthly_searches is not None and cpc is not None else None,
                   "observed_comparable_median_usd": statistics.median(prices) if prices else None,
                   "observed_comparable_range_usd": [min(prices), max(prices)] if prices else None,
                   "evidence_level": "limited" if len(prices) < 5 else "multiple comparables",
                   "market_value": None,
                   "limitations": "Inputs are not independently verified by this tool. Similar length and extension do not establish semantic comparability. Candidate buyers are not confirmed interested buyers. Search and CPC are commercial signals, not domain revenue. Observed prices are not a predicted sale price."})
    return result

def read_csv(path):
    if not path:
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("domain")
    p.add_argument("--sales")
    p.add_argument("--buyers")
    p.add_argument("--monthly-searches", type=int)
    p.add_argument("--cpc", type=float)
    a = p.parse_args()
    if (a.monthly_searches is not None and a.monthly_searches < 0) or (a.cpc is not None and (not math.isfinite(a.cpc) or a.cpc < 0)):
        p.error("Search volume and CPC must be nonnegative")
    print(json.dumps(report(a.domain, read_csv(a.sales), read_csv(a.buyers), a.monthly_searches, a.cpc), indent=2))

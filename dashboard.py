"""Generate a portable, escaped HTML portfolio report."""
import argparse
import html
from portfolio import portfolio
from valuation import evaluate

def render(rows):
    valid = []
    invalid = []
    for row in rows:
        if "error" in row:
            invalid.append(row)
        else:
            valid.append(evaluate(row["domain"]))
    valid.sort(key=lambda r: r["quality_score"], reverse=True)
    body = "".join(f'<tr><td>{html.escape(r["domain"])}</td><td>{r["quality_score"]}/100</td><td><progress max="100" value="{r["quality_score"]}"></progress></td></tr>' for r in valid)
    errors = "".join("<li>"+html.escape(str(r["domain"]))+": "+html.escape(r["error"])+"</li>" for r in invalid)
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DomainScout Portfolio</title><style>body{{font:16px system-ui;max-width:900px;margin:40px auto;padding:20px;color:#172033;background:#f4f6fa}}table{{width:100%;border-collapse:collapse;background:white}}td,th{{padding:14px;text-align:left;border-bottom:1px solid #ddd}}progress{{width:100%;accent-color:#2563eb}}small{{color:#475569}}</style><h1>DomainScout | Portfolio report</h1><p>{len(valid)} valid domains · {len(invalid)} invalid entries</p><table><thead><tr><th>Domain</th><th>Quality score</th><th>Indicator</th></tr></thead><tbody>{body}</tbody></table><h2>Validation issues</h2><ul>{errors}</ul><p><small>Lexical heuristic only. Scores do not predict sale prices or buyer demand.</small></p></html>"""

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    p.add_argument("--output", default="report.html")
    a = p.parse_args()
    with open(a.output, "w", encoding="utf-8") as f:
        f.write(render(portfolio(a.csv)))

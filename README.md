# DomainScout

An early-stage MIT-licensed Python toolkit for domain investors and researchers.

## Quick start

Python 3.10+, no third-party dependencies.

```sh
python domainscout.py example.com example.org --resolve
python rdap.py example.com
python portfolio.py domains.csv
python prospects.py example.com businesses.csv
python outreach.py add --domain example.com --contact contact@example.org --status planned
python outreach.py list
python -m unittest discover -v
```

Portfolio CSV requires a `domain` column. Prospect CSV requires a `name` column; additional columns such as website are preserved.

## Limitations

DNS and RDAP results do not prove registration availability or market value. Prospect ranking uses name similarity on a user-provided list, not live business discovery or verified purchase intent. Outreach is a local SQLite log, not an email sender. Respect opt-outs, privacy and applicable laws. Never commit private contact databases.

## Roadmap

- Verified public business discovery integrations
- More tests and robust RDAP error handling
- Portfolio reporting and follow-up scheduling

Contributions and bug reports are welcome. See LICENSE for terms.

## Domain quality scoring

Run `python valuation.py example.com example.ai`. The tool reports a transparent 0–100 heuristic based on length, extension, digits, hyphens and letter composition. It does not predict sale prices or verify demand. Research comparable sales and trademark risks independently.

## Market evidence analysis

`python market_valuation.py example.com --sales sales.csv --buyers buyers.csv --monthly-searches 100 --cpc 2`

Sales CSV columns: domain, price_usd, source, date. Buyer CSV requires website. Supply independently verified sales and keyword metrics from sources you are authorized to use. Numeric CLI values above are illustrative. The report filters sales by extension and length, deduplicates observations, reports median and range, counts candidate buyer websites and calculates a search-volume × CPC proxy. No live data feed or automatic dollar appraisal is included. Review semantic comparability and trademarks manually.

## Portfolio dashboard

Run `python dashboard.py examples/portfolio.csv --output report.html` and open report.html in your browser. The standalone report ranks domains by heuristic quality, displays score bars and flags invalid entries. No server or API key is required.

See CONTRIBUTING.md and SECURITY.md for project policies.

## Web interface

[Open DomainScout](https://ibrahim1312.github.io/DomainScout/) or open docs/index.html locally.

- Analyze multiple domains, adjust the automatically detected type, and export quality scores and USD ranges as CSV. A conservative retail range and a separate quick-sale scenario are shown.
- Enter independently checked comparable sales for each domain as: domain | USD price | source.
- Estimate break-even and profit after acquisition, renewals and commission.
- Find leads by generating exact names on other extensions and variants with extra words, hyphens and numbers. The optional DNS check sends those variants to Google Public DNS; the results distinguish address records from unverified names. Visit matched sites to identify actual businesses or follow the web search links.
- Review the lexical quality breakdown, range and comparable median. Estimates are indicative retail scenarios based on a heuristic and any supplied evidence. Inputs stay in the browser.

For a fork, enable GitHub Pages from main and the /docs folder.

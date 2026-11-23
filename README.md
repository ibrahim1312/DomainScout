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

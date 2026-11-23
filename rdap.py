"""Query public RDAP using the IANA DNS bootstrap registry."""
import json
import urllib.request
import urllib.error
from domainscout import analyze

def get_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/rdap+json, application/json", "User-Agent": "DomainScout/0.1"})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

def lookup(domain):
    name = analyze(domain)["domain"]
    registry = get_json("https://data.iana.org/rdap/dns.json")
    for suffixes, urls in registry["services"]:
        if name.split(".")[-1] in suffixes:
            base = next((u for u in urls if u.startswith("https://")), None)
            if not base:
                break
            try:
                return get_json(base.rstrip("/") + "/domain/" + name)
            except urllib.error.HTTPError as exc:
                if exc.code == 404:
                    return {"domain": name, "status": "not_found", "note": "Not proof of availability"}
                raise
    return {"domain": name, "status": "unsupported"}

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("domain")
    print(json.dumps(lookup(p.parse_args().domain), indent=2))

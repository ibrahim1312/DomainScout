"""DomainScout: basic domain research without external dependencies."""
import argparse
import json
import re
import socket

def analyze(domain, resolve=False):
    name = domain.strip().rstrip(".").lower().encode("idna").decode("ascii")
    labels = name.split(".")
    if len(name) > 253 or len(labels) < 2 or not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", x) for x in labels):
        raise ValueError("Invalid domain name")
    result = {"domain": name, "first_label_length": len(labels[0]), "extension": labels[-1], "contains_digits": any(c.isdigit() for c in labels[0]), "contains_hyphen": "-" in labels[0]}
    if resolve:
        try:
            result["addresses"] = sorted({x[4][0] for x in socket.getaddrinfo(name, None)})
        except socket.gaierror:
            result["addresses"] = []
        result["note"] = "DNS results do not establish registration availability."
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("domains", nargs="+")
    parser.add_argument("--resolve", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps([analyze(d, args.resolve) for d in args.domains], indent=2))
    except (ValueError, UnicodeError) as exc:
        parser.error(str(exc))

if __name__ == "__main__":
    main()

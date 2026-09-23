"""Download the IEEE OUI database and write a compact ``data/oui.csv``.

Output format, one record per line: ``AABBCC,Vendor Name``. Run at build time
so the portable ``.exe`` ships with full offline vendor resolution. If every
source is unreachable the script exits 0 and the app falls back to its built-in
seed list, so the build never breaks on a network hiccup.
"""
from __future__ import annotations

import csv
import io
import os
import sys
import urllib.request

SOURCES = [
    "https://standards-oui.ieee.org/oui/oui.csv",
    "https://raw.githubusercontent.com/wireshark/wireshark/master/manuf",
]

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "data", "oui.csv")


def _fetch(url: str, timeout: int = 40) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "netscan-build"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            print(f"  fetched {url} ({resp.status})")
            return resp.read()
    except Exception as exc:  # noqa: BLE001 - build resilience
        print(f"  failed {url}: {exc}")
        return None


def _parse_ieee_csv(raw: bytes) -> dict[str, str]:
    out: dict[str, str] = {}
    text = raw.decode("utf-8", "ignore")
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    for row in reader:
        if len(row) < 3:
            continue
        prefix = row[1].strip().upper().replace("-", "").replace(":", "")
        vendor = row[2].strip().strip('"')
        if len(prefix) == 6 and vendor:
            out.setdefault(prefix, vendor)
    return out


def _parse_wireshark_manuf(raw: bytes) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in raw.decode("utf-8", "ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        prefix = parts[0].strip().upper().replace(":", "").replace("-", "")
        if "/" in prefix or len(prefix) != 6:
            continue
        vendor = (parts[-1] if len(parts) >= 2 else "").strip()
        if prefix and vendor:
            out.setdefault(prefix, vendor)
    return out


def main() -> int:
    db: dict[str, str] = {}
    for url in SOURCES:
        raw = _fetch(url)
        if not raw:
            continue
        db = _parse_ieee_csv(raw) if url.endswith(".csv") else _parse_wireshark_manuf(raw)
        if len(db) > 1000:
            break

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if not db:
        print("No OUI data downloaded; keeping built-in seed only.")
        # Ensure the file exists so PyInstaller's --add-data path is valid.
        open(OUT, "a", encoding="utf-8").close()
        return 0

    with open(OUT, "w", encoding="utf-8") as fh:
        for prefix in sorted(db):
            fh.write(f"{prefix},{db[prefix]}\n")
    print(f"Wrote {len(db)} vendor prefixes to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

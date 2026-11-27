#!/usr/bin/env python3
"""Re-read published private-lease prices from each lessor's page.

A row changes only when that page still names the model and a monthly
amount. A page that cannot be read leaves the stored amount in place.
Nothing is invented.

  python3 scripts/leasing/refresh.py --self-test
  python3 scripts/leasing/refresh.py --write
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "leasing" / "published.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
TODAY = time.strftime("%Y-%m-%d")


def plain(raw: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", raw)
    text = re.sub(r"(?i)<[^>]+>", " ", text)
    text = unescape(text).replace("\xa0", " ").replace("\u2011", "-").replace("\u2010", "-")
    text = text.replace("\u2013", "-").replace("\u2060", "")
    return re.sub(r"\s+", " ", text)


def amount(match: re.Match[str] | None) -> int | None:
    if not match:
        return None
    digits = re.sub(r"\s+", "", match.group(1))
    if not digits.isdigit():
        return None
    value = int(digits)
    return value if value > 0 else None


def first(pattern: str, text: str) -> int | None:
    return amount(re.search(pattern, text))


def put(found: dict[str, int], row_id: str, value: int | None) -> None:
    if value is not None:
        found[row_id] = value


def extract(url: str, text: str) -> dict[str, int]:
    found: dict[str, int] = {}
    if "volkswagen.se/sv/modeller/polo" in url:
        put(found, "se-vw-polo-life-swe", first(r"från endast\s+(\d[\d ]*)\s*kr/mån", text))
    elif "erbjudanden.html" in url:
        put(found, "se-vw-golf-life-edition", first(r"Golf Life Edition från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-vw-t-roc-life", first(r"T-Roc från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-vw-id-polo-life", first(r"ID\. Polo Life från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-vw-id-tiguan-life-77", first(r"ID\. Tiguan Life 77 kWh från\s+(\d[\d ]*)\s*kr/mån", text))
        put(
            found,
            "se-vw-id-tiguan-life-4motion-77",
            first(r"ID\. Tiguan Life 4MOTION 77 kWh från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(found, "se-vw-id-tiguan-style-77", first(r"ID\. Tiguan Style 77 kWh från\s+(\d[\d ]*)\s*kr/mån", text))
        put(
            found,
            "se-vw-id-tiguan-style-4motion-77",
            first(r"ID\. Tiguan Style 4MOTION 77 kWh från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-vw-id7-tourer-pro-s",
            first(r"ID\.7 Tourer Pro S SWE Edition.{0,240}?(\d[\d ]*)\s*kr/mån", text),
        )
    elif "modeller/id3" in url:
        put(found, "se-vw-id3-neo-trend", first(r"Privatleasa från\s+(\d[\d ]*)\s*kr/mån", text))
    elif "id-polo/kopa" in url:
        put(
            found,
            "se-vw-id-polo-style",
            first(r"ID\. Polo Style finns tillgänglig för privatleasing från\s+(\d[\d ]*)\s*kr/mån", text),
        )
    elif "kia.com/se/kopa/privatleasing" in url:
        put(found, "se-kia-ev2", first(r"EV2 Black Line Long Range 4-sits.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-kia-ev3", first(r"EV3 \| Long Range.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-kia-ev4", first(r"EV4 GT Line FWD Long Range.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-kia-ev5", first(r"EV5 Plus FWD Long Range.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
        put(
            found,
            "se-kia-sorento-phev",
            first(r"Sorento 1\.6 T-GDi Plug-In Hybrid AUT AWD Advance.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-kia-sportage-phev",
            first(r"Sportage GT Line Panorama Two color Plug-in Hybrid.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-kia-seltos-hybrid",
            first(r"Seltos X-Line 1\.6 GDI HYBRID DCT AWD.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-kia-k4-sportswagon",
            first(r"K4 SW 1\.0 T-GDi 115hp MT6 Action.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-kia-seltos",
            first(r"Seltos Action 1\.6 T-GDI MT FWD.{0,260}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(
            found,
            "se-kia-k4-sportswagon-hybrid",
            first(r"K4 Sportswagon Hybrid \| GT-Line.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text),
        )
        put(found, "se-kia-stonic", first(r"Stonic 1\.0 T-GDi MT Action.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
        put(found, "se-kia-picanto", first(r"Picanto 1\.0 GDI AMT Action.{0,220}?Från\s+(\d[\d ]*)\s*kr/mån", text))
    elif "volkswagen.nl" in url and "private-lease" in url:
        pairs = [
            ("nl-vw-id-cross", r"ID\. Cross\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-polo", r"De Polo\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-t-cross", r"De T-Cross\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-taigo", r"De Taigo\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-golf", r"De Golf\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-id7", r"De ID\.7\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-tiguan", r"De Tiguan\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-t-roc", r"De nieuwe T-Roc\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-id3-neo", r"De nieuwe ID\.3 Neo\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-id4", r"De ID\.4\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-id7-tourer", r"De ID\.7 Tourer\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-passat", r"De Passat\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-tayron", r"De Tayron\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-golf-variant", r"De Golf Variant\s+Private Lease vanaf €\s*(\d+)"),
            ("nl-vw-id-buzz", r"De ID\. Buzz\s+Private Lease vanaf €\s*(\d+)"),
        ]
        for row_id, pattern in pairs:
            put(found, row_id, first(pattern, text))
    elif "volkswagen.fi" in url and "leasing" in url:
        pairs = [
            ("fi-vw-id-polo-trend", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. Polo Trend"),
            ("fi-vw-id-polo-gti", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. Polo GTI"),
            ("fi-vw-id-cross-trend", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. Cross Trend"),
            ("fi-vw-id3-neo-trend", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\.3 Neo Trend"),
            ("fi-vw-id-tiguan-comfort", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. Tiguan Comfort"),
            (
                "fi-vw-id-tiguan-style-launch",
                r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. Tiguan Style Launch Edition 4MOTION",
            ),
            ("fi-vw-id4-pro-4motion", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\.4 Pro 4MOTION Elegance"),
            ("fi-vw-id7-tourer-pure", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 Tourer Pure Elegance"),
            (
                "fi-vw-id7-tourer-gtx-business",
                r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 Tourer GTX 4MOTION Business",
            ),
            (
                "fi-vw-id7-tourer-gtx-premium",
                r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 Tourer GTX 4MOTION Premium",
            ),
            ("fi-vw-id7-pure", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 Pure Elegance"),
            ("fi-vw-id7-gtx-business", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 GTX 4MOTION Business"),
            ("fi-vw-id7-gtx-premium", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}ID\. 7 GTX 4MOTION Premium"),
            ("fi-vw-t-roc-comfort", r"Alkaen\s+(\d+)\s*€/kk(?:(?!€).){0,180}T-Roc Comfort"),
        ]
        for row_id, pattern in pairs:
            put(found, row_id, first(pattern, text))
    elif "volkswagen.no/no" in url and "alle-bilmodeller" not in url:
        put(
            found,
            "no-vw-id-buzz-pro-short",
            first(r"ID\. Buzz Pro kort utgave.{0,1600}?Månedsleie\s+(\d[\d ]*)\s*kr", text),
        )
    return found


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urlopen(request, timeout=25, context=CTX) as response:
        raw = response.read(2_000_000)
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, "replace")


def apply(data: dict, readings: dict[str, dict[str, int]], unreadable: list[str]) -> tuple[list[str], list[str]]:
    updated: list[str] = []
    missing: list[str] = []
    for row in data["rows"]:
        source = row["sourceUrl"]
        if source in unreadable:
            continue
        found = readings.get(source, {})
        if row["id"] not in found or found[row["id"]] <= 0:
            missing.append(row["id"])
            continue
        fresh = found[row["id"]]
        row["checkedAt"] = TODAY
        if fresh != row["amount"]:
            updated.append(f"{row['id']} {row['amount']} -> {fresh}")
            row["amount"] = fresh
    data["meta"] = {
        "checkedAt": TODAY,
        "note": (
            "A row stays only when the lessor's own page named the model and the monthly amount. "
            "The monthly refresh reads those pages again and changes an amount only when the page "
            "shows a new one. A page that cannot be read leaves the previous amount in place."
        ),
        "unreadable": unreadable,
    }
    return updated, missing


def write_refresh() -> int:
    data = json.loads(DATA_PATH.read_text())
    urls = list(dict.fromkeys(row["sourceUrl"] for row in data["rows"]))
    readings: dict[str, dict[str, int]] = {}
    unreadable: list[str] = []
    for url in urls:
        try:
            readings[url] = extract(url, plain(fetch(url)))
            print("read", url, sorted(readings[url]), flush=True)
        except Exception as error:
            unreadable.append(url)
            print("unreadable", url, type(error).__name__, flush=True)
    updated, missing = apply(data, readings, unreadable)
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", len(updated))
    for line in updated:
        print(line)
    print("unreadable", len(unreadable))
    print("missing", len(missing))
    for row_id in missing:
        print("missing", row_id)
    return 1 if missing or unreadable else 0


def self_test() -> int:
    polo = extract(
        "https://www.volkswagen.se/sv/modeller/polo.html",
        "privatleasing från endast 2 995 kr/mån",
    )
    assert polo == {"se-vw-polo-life-swe": 2995}, polo
    kia = extract(
        "https://www.kia.com/se/kopa/privatleasing/",
        "Picanto 1.0 GDI AMT Action Från 3 145 kr/mån EV2 Black Line Long Range 4-sits Från 3 495 kr/mån",
    )
    assert kia["se-kia-picanto"] == 3145 and kia["se-kia-ev2"] == 3495, kia
    dutch = extract(
        "https://www.volkswagen.nl/nl/lease-en-financiering/prive/private-lease.html",
        "ID. Cross Private Lease vanaf € 439 De Polo Private Lease vanaf € 449",
    )
    assert dutch["nl-vw-id-cross"] == 439 and dutch["nl-vw-polo"] == 449, dutch
    finland = extract(
        "https://www.volkswagen.fi/fi/auton-hankinta/leasing.html",
        "Alkaen 359 €/kk ID. Polo Trend",
    )
    assert finland == {"fi-vw-id-polo-trend": 359}, finland
    norway = extract(
        "https://www.volkswagen.no/no",
        "ID. Buzz Pro kort utgave 79 kWh Månedsleie 5 490 kr",
    )
    assert norway == {"no-vw-id-buzz-pro-short": 5490}, norway
    print("self-test ok")
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    if "--write" in sys.argv:
        return write_refresh()
    print("Use --self-test or --write", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

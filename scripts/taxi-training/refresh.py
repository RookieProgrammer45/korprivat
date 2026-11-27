#!/usr/bin/env python3
"""Re-read published taxi-driver course and test fees.

A row changes only when that page still publishes a number for the same
course or test. A page that cannot be read leaves the stored amount in
place. Nothing is invented.

  python3 scripts/taxi-training/refresh.py --self-test
  python3 scripts/taxi-training/refresh.py --write
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
DATA_PATH = ROOT / "data" / "taxi-training" / "published.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
TODAY = time.strftime("%Y-%m-%d")


def plain(raw: str) -> str:
    text = raw.replace("\xa3", "£")
    text = re.sub(r"(?is)<script[\s\S]*?</script>", " ", text)
    text = re.sub(r"(?is)<style[\s\S]*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def amount(raw: str) -> float:
    text = raw.replace("\xa0", " ").replace(" ", "")
    if re.fullmatch(r"\d+,\d{2}", text):
        return float(text.replace(",", "."))
    if re.fullmatch(r"\d+\.\d{2}", text):
        return float(text)
    if re.fullmatch(r"\d+", text):
        return float(text)
    raise ValueError(raw)


def stored(value: float) -> int | float:
    rounded = round(value, 2)
    if abs(rounded - round(rounded)) < 1e-9:
        return int(round(rounded))
    return rounded


def first(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, re.I)
    if not match:
        return None
    return amount(match.group(1))


def pair(pattern: str, text: str) -> tuple[float, float] | None:
    match = re.search(pattern, text, re.I)
    if not match:
        return None
    return amount(match.group(1)), amount(match.group(2))


def put(found: dict[str, float], key: str, value: float | None) -> None:
    if value is not None and value > 0:
        found[key] = value


def extract(url: str, text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    if "kptrafikskola.se" in url:
        put(found, "se-kompassen-course", first(r"Taxiförarutbildning\s+(\d[\d ]*)\s*kr", text))
    elif "korkortspedagogen.se" in url:
        put(found, "se-pedagogen-course", first(r"Taxipaket\s+(\d[\d ]*)\s*kr", text))
    elif "korkortcenter.se" in url:
        put(found, "se-korkortcenter-theory", first(r"Teorimaterial\s+(\d[\d ]*)\s*kr", text))
        put(
            found,
            "se-korkortcenter-course",
            first(r"Premium-paketet.{0,140}?kostar\s+(\d[\d ]*)\s*kr", text),
        )
    elif "skarholmenstrafikskola.se" in url:
        put(
            found,
            "se-skarholmen-course",
            first(r"taxiförarutbildning kostar\s+(\d[\d ]*)\s*kr", text),
        )
        put(
            found,
            "se-skarholmen-premium",
            first(r"Förberedelse inför körprov\s+(\d[\d ]*)\s*kr", text),
        )
    elif "vagsjotrafikskola.se" in url:
        put(found, "se-vagsjo-course", first(r"Paketpris\s+(\d[\d ]*)", text))
    elif "worcestershire.gov.uk" in url:
        put(
            found,
            "gb-worcestershire-course",
            first(r"multiple-choice test is £(\d+\.?\d*)", text),
        )
    elif "edinburgh.gov.uk" in url:
        put(found, "gb-edinburgh-course", first(r"foundation course is £(\d+)", text))
        put(found, "gb-edinburgh-topography", first(r"single assessment is £(\d+)", text))
    elif "chelmsford.gov.uk" in url:
        put(found, "gb-chelmsford-course", first(r"initial training course is £(\d+)", text))
        put(found, "gb-chelmsford-refresher", first(r"refresher training course is £(\d+)", text))
        put(found, "gb-chelmsford-topography", first(r"topographical test of £(\d+\.\d{2})", text))
    elif "nidirect.gov.uk" in url:
        put(found, "gb-ni-theory", first(r"Taxi Driver £(\d+\.\d{2})", text))
        fees = pair(r"Taxi driver £(\d+\.\d{2}) £(\d+\.\d{2})", text)
        if fees:
            found["gb-ni-practical"] = fees[0]
            found["gb-ni-practical-evening"] = fees[1]
    return found


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urlopen(request, timeout=25, context=CTX) as response:
        raw = response.read(2_000_000)
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, "replace")


def apply(data: dict, readings: dict[str, dict[str, float]], unreadable: list[str]) -> list[str]:
    updated: list[str] = []
    for row in data["rows"]:
        source = row["sourceUrl"]
        if source in unreadable:
            continue
        found = readings.get(source, {})
        if row["id"] not in found or found[row["id"]] <= 0:
            continue
        fresh = stored(found[row["id"]])
        row["checkedAt"] = TODAY
        if fresh != row["amount"]:
            updated.append(f"{row['id']} {row['amount']} -> {fresh}")
            row["amount"] = fresh
    data["meta"] = {
        "checkedAt": TODAY,
        "note": (
            "A row stays only when the school or the authority page published the amount. "
            "The monthly refresh reads those pages again and changes an amount only when the "
            "page shows a new one. A page that cannot be read leaves the previous amount in place."
        ),
        "unreadable": unreadable,
    }
    return updated


def write_refresh() -> int:
    data = json.loads(DATA_PATH.read_text())
    urls = list(dict.fromkeys(row["sourceUrl"] for row in data["rows"]))
    readings: dict[str, dict[str, float]] = {}
    unreadable: list[str] = []
    for url in urls:
        try:
            readings[url] = extract(url, plain(fetch(url)))
            print("read", url, sorted(readings[url]), flush=True)
        except Exception as error:
            unreadable.append(url)
            print("unreadable", url, type(error).__name__, flush=True)
    updated = apply(data, readings, unreadable)
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", len(updated))
    for line in updated:
        print(line)
    print("unreadable", len(unreadable))
    return 0


def self_test() -> int:
    kompassen = extract(
        "https://elev.kptrafikskola.se/shop/taxi/taxiforarutbildning",
        'Taxiförarutbildning 2 650 kr Innehåll 1 st Teoricentralen Taxi "Frågor" 850 kr 3 st Taxi lektion 40 min 1 800 kr',
    )
    assert kompassen == {"se-kompassen-course": 2650}, kompassen
    center = extract(
        "https://www.korkortcenter.se/taxi-korkort",
        "Taxikörkort Teorimaterial 4 000 kr Premium-paketet med körlektioner och provförberedelse kostar 5 000 kr",
    )
    assert center == {"se-korkortcenter-theory": 4000, "se-korkortcenter-course": 5000}, center
    skarholmen = extract(
        "https://www.skarholmenstrafikskola.se/taxi-korkort",
        "Spara 1 000 kr 5 000 4 000 kr Förberedelse inför körprov 5 000 kr Vår kompletta taxiförarutbildning kostar 4 000 kr",
    )
    assert skarholmen == {"se-skarholmen-course": 4000, "se-skarholmen-premium": 5000}, skarholmen
    vagsjo = extract(
        "https://www.vagsjotrafikskola.se/taxiforarlegitimation/",
        "Paketpris 4 420 Teorimaterial komplett Du sparar 460kr",
    )
    assert vagsjo == {"se-vagsjo-course": 4420}, vagsjo
    chelmsford = extract(
        "https://www.chelmsford.gov.uk/business/licensing/taxis/driver-licence/taxi-driver-training/",
        "The cost of the initial training course is £140. The cost of the refresher training course is £70. topographical test of £21.50",
    )
    assert chelmsford == {
        "gb-chelmsford-course": 140,
        "gb-chelmsford-refresher": 70,
        "gb-chelmsford-topography": 21.5,
    }, chelmsford
    ni = extract(
        "https://www.nidirect.gov.uk/articles/driving-test-fees",
        "Taxi Driver £34.00 Taxi driver £70.00 £109.00",
    )
    assert ni == {"gb-ni-theory": 34, "gb-ni-practical": 70, "gb-ni-practical-evening": 109}, ni
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

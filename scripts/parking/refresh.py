#!/usr/bin/env python3
"""Re-read published parking hour prices.

A row stays only when the city or operator page still states a number for that
place. A page that cannot be read keeps the previous amount, and the job exits
1 so that read is not merged. The script never adds a city.
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import urllib.request
from datetime import date
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "parking" / "published.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"

OSLO = "https://www.oslo.kommune.no/gate-transport-og-parkering/parkering/priser-og-betaling-for-parkering/"
HELSINKI = "https://www.hel.fi/fi/kaupunkiymparisto-ja-liikenne/pysakointi/pysakointipaikat-hinnat-ja-maksutavat"
COPENHAGEN = "https://www.kk.dk/borger/parkering-trafik-og-veje/parkering/priser-og-parkeringszoner"
MALMO = "https://malmo.se/Bo-och-leva/Stadsmiljo-och-trafik/Parkering/Parkeringsavgifter.html"


def plain(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    text = unescape(raw).replace("\xa0", " ").replace("\u2013", "-").replace("\u2011", "-")
    return re.sub(r"\s+", " ", text)


def first_int(pattern: str, text: str) -> int | None:
    match = re.search(pattern, text)
    if not match:
        return None
    return int(match.group(1))


def stockholm(text: str) -> int | None:
    return first_int(r"Besöksparkering (\d+) kr / timme", text)


def gothenburg(text: str) -> int | None:
    return first_int(r"Pris:\s*(\d+) kr/tim", text)


def malmo(taxa: str):
    def parse(text: str) -> int | None:
        return first_int(rf"Taxa {taxa} (\d+) kr/tim", text)

    return parse


def oslo(code: str):
    def parse(text: str) -> int | None:
        return first_int(
            rf"Takstgruppe {code}.{{0,500}}?Bensin, diesel, hybrid (\d+)\s*kr",
            text,
        )

    return parse


def helsinki(anchor: str):
    def parse(text: str) -> int | None:
        return first_int(rf"{anchor} (\d+) euroa / tunti", text)

    return parse


def copenhagen(index: int):
    def parse(text: str) -> int | None:
        match = re.search(
            r"Priser 2026 i betalingszonerne.{0,300}?Dag \(kl\. 08-18\) (\d+) kr\. (\d+) kr\. (\d+) kr\. (\d+) kr\.",
            text,
        )
        if not match:
            return None
        return int(match.group(index))

    return parse


PARSERS = {
    "se-stockholm-norra-djurgardsstaden": stockholm,
    "se-stockholm-fafangan": stockholm,
    "se-stockholm-st-eriksplan": stockholm,
    "se-stockholm-norra-bantorget": stockholm,
    "se-goteborg-focus": gothenburg,
    "se-goteborg-liseberg-sodra": gothenburg,
    "se-goteborg-skanegatan": gothenburg,
    "se-goteborg-tomtegatan": gothenburg,
    "se-malmo-taxa-a": malmo("A"),
    "se-malmo-taxa-b": malmo("B"),
    "se-malmo-taxa-c": malmo("C"),
    "se-malmo-taxa-d": malmo("D"),
    "se-malmo-taxa-e": malmo("E"),
    "se-malmo-taxa-f": malmo("F"),
    "no-oslo-ring-1": oslo("2012"),
    "no-oslo-utenfor-ring-1": oslo("2020"),
    "no-oslo-mellom-ringene": oslo("2200"),
    "no-oslo-ytre-by": oslo("2310"),
    "no-oslo-utenfor-ring-3": oslo("2700"),
    "fi-helsinki-zone-1": helsinki("ydinkeskustassa"),
    "fi-helsinki-zone-2": helsinki("kantakaupungissa"),
    "dk-kobenhavn-rod": copenhagen(1),
    "dk-kobenhavn-gron": copenhagen(2),
    "dk-kobenhavn-bla": copenhagen(3),
    "dk-kobenhavn-gul": copenhagen(4),
}


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(request, context=ssl.create_default_context(), timeout=30) as response:
        return plain(response.read().decode("utf-8", "replace"))


def self_test() -> None:
    samples = {
        "se-stockholm-norra-djurgardsstaden": "Besöksparkering 25 kr / timme — Alla dagar",
        "se-goteborg-focus": "Pris: 30 kr/tim alla dagar 08-22",
        "se-malmo-taxa-a": "Taxa A max 30 min 15 kr Taxa A 30 kr/tim",
        "se-malmo-taxa-b": "Taxa B max 1 tim 25 kr/tim Taxa B 25 kr/tim",
        "no-oslo-ring-1": "Takstgruppe 2012 (Gateparkering innenfor Ring 1) Bensin, diesel, hybrid 93 kr",
        "no-oslo-utenfor-ring-3": "Takstgruppe 2700 (P-plasser utenfor Ring 3) Bensin, diesel, hybrid 21 kr",
        "fi-helsinki-zone-1": "ydinkeskustassa 4 euroa / tunti",
        "fi-helsinki-zone-2": "muualla kantakaupungissa 2 euroa / tunti",
        "dk-kobenhavn-gul": (
            "Priser 2026 i betalingszonerne Rød zone Dag (kl. 08-18) 45 kr. 45 kr. 26 kr. 17 kr. "
            "Priser 2027 i betalingszonerne Dag (kl. 08-18) 47 kr. 47 kr. 27 kr. 17 kr."
        ),
    }
    expected = {
        "se-stockholm-norra-djurgardsstaden": 25,
        "se-goteborg-focus": 30,
        "se-malmo-taxa-a": 30,
        "se-malmo-taxa-b": 25,
        "no-oslo-ring-1": 93,
        "no-oslo-utenfor-ring-3": 21,
        "fi-helsinki-zone-1": 4,
        "fi-helsinki-zone-2": 2,
        "dk-kobenhavn-gul": 17,
    }
    for row_id, amount in expected.items():
        found = PARSERS[row_id](samples[row_id])
        if found != amount:
            raise SystemExit(f"self-test {row_id}: {found}")
    # The 2027 table must not replace the 2026 day price.
    if PARSERS["dk-kobenhavn-rod"](samples["dk-kobenhavn-gul"]) != 45:
        raise SystemExit("self-test copenhagen year")
    print("self-test ok")


def write_refresh() -> int:
    document = json.loads(DATA.read_text())
    pages: dict[str, str | None] = {}
    missing: list[str] = []
    unreadable: list[str] = []
    updated = 0
    today = date.today().isoformat()
    for row in document["rows"]:
        row_id = row["id"]
        parser = PARSERS.get(row_id)
        url = row["sourceUrl"]
        if parser is None:
            missing.append(row_id)
            continue
        if url not in pages:
            try:
                pages[url] = fetch(url)
            except Exception:
                pages[url] = None
        text = pages[url]
        if text is None:
            if url not in unreadable:
                unreadable.append(url)
            continue
        amount = parser(text)
        if amount is None or amount <= 0:
            missing.append(row_id)
            continue
        if amount != row["amount"]:
            updated += 1
            row["amount"] = amount
        row["checkedAt"] = today
    document["meta"]["checkedAt"] = today
    document["meta"]["unreadable"] = unreadable
    if missing or unreadable:
        print(f"updated {updated} missing {len(missing)} unreadable {len(unreadable)}")
        for row_id in missing:
            print("missing", row_id)
        for url in unreadable:
            print("unreadable", url)
        return 1
    DATA.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    print(f"updated {updated} missing 0 unreadable 0")
    return 0


def main() -> None:
    if "--self-test" in sys.argv:
        self_test()
        return
    if "--write" in sys.argv:
        raise SystemExit(write_refresh())
    raise SystemExit("use --self-test or --write")


if __name__ == "__main__":
    main()

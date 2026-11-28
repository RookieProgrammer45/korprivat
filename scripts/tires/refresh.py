#!/usr/bin/env python3
"""Re-read published tire-service prices from each workshop page.

A row changes only when that page still publishes a number for the same
service. A page that cannot be read, or a page whose price cannot be found,
leaves the stored amount in place. Nothing is invented.

  python3 scripts/tires/refresh.py --self-test
  python3 scripts/tires/refresh.py --write
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
DATA_PATH = ROOT / "data" / "tires" / "published.json"
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


def extract(url: str, text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    if "euromaster.se" in url:
        car = first(r"upp till 17.{0,240}?Pris från:\s*(\d+) kr", text)
        van = first(r"Lätt lastbil.{0,240}?Pris från:\s*(\d+) kr", text)
        if car:
            found["se-euromaster-car-change"] = car
        if van:
            found["se-euromaster-van-change"] = van
        return found
    if "mekonomen.se/bilverkstad/dackbyte" in url:
        price = first(r"däckbyte från\s+(\d+)\s*kr", text)
        if price:
            found["se-mekonomen-car-change"] = price
        return found
    if "bilia.se/verkstad/dacktjanster/dackbyte" in url:
        change = first(r"Från\s+(\d+)\s*kr", text)
        if change:
            found["se-bilia-car-change"] = change
        if re.search(r"Från\s+1\.195\s*kr", text):
            found["se-bilia-car-hotel"] = 1195
        return found
    if "holmgrensbil.se" in url and "dackbyte" in url:
        price = first(r"däckbyte för endast\s+(\d+)\s*kr", text)
        if price:
            found["se-holmgrens-car-change"] = price
        return found
    if "citydack.se/vara_tjanster" in url:
        car = first(r"Personbil\s+(\d+)\s*kr", text)
        van = first(r"Lätt lastbil och SUV\s+(\d+)\s*kr", text)
        hotel = first(r"Från\s+(\d+)\s*kr per säsong", text)
        if car:
            found["se-citydack-car-change"] = car
        if van:
            found["se-citydack-van-change"] = van
        if hotel:
            found["se-citydack-car-hotel"] = hotel
        return found
    if "thansen.se" in url:
        price = first(r"alla fyra hjul kostar det från\s+(\d+,\d{2})", text)
        if price:
            found["se-thansen-car-change"] = price
        return found
    if "meca.se/vara-tjanster/dackbyte" in url:
        price = first(r"däckbyte från\s+(\d+)\s*kr", text)
        if price:
            found["se-meca-car-change"] = price
        return found
    if "meca.se/vara-tjanster/dackhotell" in url:
        price = first(r"däckhotell från\s+(\d+)\s*kr", text)
        if price:
            found["se-meca-car-hotel"] = price
        return found
    if "brandtbil.se" in url and "dackbyte" in url:
        ordinary = re.findall(r"Ordinarie pris från:\s*([\d\s]+)\s*kr", text, re.I)
        if ordinary:
            found["se-brandt-car-change"] = amount(ordinary[0])
        if len(ordinary) > 1:
            found["se-brandt-car-hotel"] = amount(ordinary[1])
        return found
    if "mechanum.com/tjanster/dack/hjulskifte" in url:
        if re.search(r"Ordinarie pris\s+499\s*kr", text):
            found["se-mechanum-car-change"] = 499
        if re.search(r"paketpris\.\s*1\s*299\s*kr", text):
            found["se-mechanum-car-hotel"] = 1299
        return found
    if "autoria.no/verksted/dekkskift" in url:
        price = first(r"Fra\s+(\d+),-", text)
        if price:
            found["no-autoria-car-change"] = price
        return found
    if "bos.no" in url and "dekkskift" in url:
        price = first(r"hjulskift fra\s+(\d+)\s*kr", text)
        if price:
            found["no-bos-car-change"] = price
        return found
    if url.rstrip("/").endswith("dackbyte"):
        price = first(r"Från (\d+) kr", text)
        if price:
            found["se-vianor-car-change"] = price
        return found
    if "vianor.se/dackverkstad" in url:
        hotel = first(r"Däckhotell Från (\d+) kr", text)
        mount = first(r"Däckservice Från (\d+) kr", text)
        if hotel:
            found["se-vianor-car-hotel"] = hotel
        if mount:
            found["se-vianor-car-mount"] = mount
        return found
    if "vianor.no/dekkverksted/dekkskift" in url:
        price = first(r"Startpris fra (\d+)\s*kr", text)
        if price:
            found["no-vianor-car-change"] = price
        return found
    if "vianor.no/dekkverksted" in url:
        hotel = first(r"Dekkhotell Fra (\d+) kr", text)
        mount = first(r"Dekkservice Fra (\d+) kr", text)
        if hotel:
            found["no-vianor-car-hotel"] = hotel
        if mount:
            found["no-vianor-car-mount"] = mount
        return found
    if url.rstrip("/").endswith("renkaiden-vaihto"):
        price = first(r"Alkaen (\d+,\d{2}) €", text)
        if price:
            found["fi-vianor-car-change"] = price
        return found
    if "vianor.fi/rengaspalvelut" in url:
        price = first(r"Rengashotelli Alk\. (\d+,\d{2}) €", text)
        if price:
            found["fi-vianor-car-hotel"] = price
        return found
    if "kwik-fit.nl" in url:
        change = first(r"4 wielen\): vanaf €\s*(\d+)", text)
        mount = first(r"4 banden.{0,40}?vanaf €\s*(\d+)", text)
        if change:
            found["nl-kwikfit-car-change"] = change
        if mount:
            found["nl-kwikfit-car-mount"] = mount
        return found
    if "kwik-fit.com" in url:
        if re.search(r"cost up to\s+.?\s*30", text, re.I):
            found["gb-kwikfit-car-mobile"] = 30
            found["gb-kwikfit-van-mobile"] = 30
        return found
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
            "A row stays only when the workshop page published the amount. "
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
            print("read", url, len(readings[url]), flush=True)
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
    euro = extract(
        "https://www.euromaster.se/bilservice/dack/dackbyte",
        "upp till 17 tum. Pris från: 350 kr Lätt lastbil & husbil Pris från: 350 kr",
    )
    assert euro == {"se-euromaster-car-change": 350, "se-euromaster-van-change": 350}, euro
    change = extract(
        "https://vianor.se/dackverkstad/dackbyte/",
        "Från 545 kr utlottningen av 5000 kr",
    )
    assert change == {"se-vianor-car-change": 545}, change
    workshop = extract(
        "https://vianor.se/dackverkstad/",
        "Däckhotell Från 970 kr Däckservice vid däckköp Från 1596 kr Däckservice Från 2160 kr",
    )
    assert workshop == {"se-vianor-car-hotel": 970, "se-vianor-car-mount": 2160}, workshop
    shift = extract(
        "https://vianor.no/dekkverksted/dekkskift/",
        "Startpris fra 780kr fra 78 kr/mnd",
    )
    assert shift == {"no-vianor-car-change": 780}, shift
    norway = extract(
        "https://vianor.no/dekkverksted/",
        "Dekkhotell Fra 1690 kr Dekkservice - ved dekkjøp Fra 1820 kr Dekkservice Fra 3080 kr",
    )
    assert norway == {"no-vianor-car-hotel": 1690, "no-vianor-car-mount": 3080}, norway
    finland = extract(
        "https://vianor.fi/rengaspalvelut/",
        "Renkaiden vaihto Alk. 42,00 € Rengashotelli Alk. 37,00 €",
    )
    assert finland == {"fi-vianor-car-hotel": 37}, finland
    dutch = extract(
        "https://www.kwik-fit.nl/banden-wisselen",
        "Bandenwissel (4 banden ≤ 14 inch): vanaf €140 Wielenwissel (4 wielen): vanaf €70",
    )
    assert dutch == {"nl-kwikfit-car-change": 70, "nl-kwikfit-car-mount": 140}, dutch
    mobile = extract(
        "https://www.kwik-fit.com/tyres/mobile-tyre-fitting",
        "appointments cost up to £30 depending on the slot",
    )
    assert mobile == {"gb-kwikfit-car-mobile": 30, "gb-kwikfit-van-mobile": 30}, mobile
    mekonomen = extract(
        "https://www.mekonomen.se/bilverkstad/dackbyte",
        "däckbyte från 249 kr",
    )
    assert mekonomen == {"se-mekonomen-car-change": 249}, mekonomen
    bilia = extract(
        "https://www.bilia.se/verkstad/dacktjanster/dackbyte/",
        "Från 495 kr Däckhotell Från 1.195 kr",
    )
    assert bilia == {"se-bilia-car-change": 495, "se-bilia-car-hotel": 1195}, bilia
    holmgren = extract(
        "https://www.holmgrensbil.se/dackverkstad/dackbyte",
        "däckbyte för endast 475 kr",
    )
    assert holmgren == {"se-holmgrens-car-change": 475}, holmgren
    city = extract(
        "https://www.citydack.se/vara_tjanster",
        "Från 895 kr per säsong Personbil 345 kr Lätt lastbil och SUV 395 kr",
    )
    assert city == {
        "se-citydack-car-change": 345,
        "se-citydack-van-change": 395,
        "se-citydack-car-hotel": 895,
    }, city
    thansen = extract(
        "https://www.thansen.se/bil/dack-och-falgar/montering-och-balansering/n-2084705019",
        "För alla fyra hjul kostar det från 359,80 kr",
    )
    assert thansen == {"se-thansen-car-change": 359.8}, thansen
    meca = extract(
        "https://www.meca.se/vara-tjanster/dackbyte/byta-till-sommardack",
        "ett däckbyte från 250 kr",
    )
    assert meca == {"se-meca-car-change": 250}, meca
    hotel = extract(
        "https://www.meca.se/vara-tjanster/dackhotell",
        "däckhotell från 300 kr per säsong",
    )
    assert hotel == {"se-meca-car-hotel": 300}, hotel
    brandt = extract(
        "https://www.brandtbil.se/utbud/dackverkstad/dackbyte/",
        "Ordinarie pris från: 695 kr Ordinarie pris från: 1 295 kr",
    )
    assert brandt == {"se-brandt-car-change": 695, "se-brandt-car-hotel": 1295}, brandt
    mechanum = extract(
        "https://mechanum.com/tjanster/dack/hjulskifte/",
        "Ordinarie pris 499 kr paketpris. 1 299 kr",
    )
    assert mechanum == {"se-mechanum-car-change": 499, "se-mechanum-car-hotel": 1299}, mechanum
    autoria = extract(
        "https://www.autoria.no/verksted/dekkskift",
        "Fra 599,-",
    )
    assert autoria == {"no-autoria-car-change": 599}, autoria
    steen = extract(
        "https://www.bos.no/bilverksted/dekkskift",
        "Bestill hjulskift fra 699 kr",
    )
    assert steen == {"no-bos-car-change": 699}, steen
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

#!/usr/bin/env python3
"""Re-read published inspection prices from each station or authority page.

A row changes only when that page still publishes a number for the same
inspection. A page that cannot be read, or a page whose price cannot be
found, leaves the stored amount in place. Nothing is invented.

  python3 scripts/inspections/refresh.py --self-test
  python3 scripts/inspections/refresh.py --write
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
DATA_PATH = ROOT / "data" / "inspections" / "published.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
TODAY = time.strftime("%Y-%m-%d")

STATES = {
    "Baden-Württemberg": "bw",
    "Bayern": "by",
    "Berlin": "be",
    "Brandenburg": "bb",
    "Bremen": "hb",
    "Hamburg": "hh",
    "Hessen": "he",
    "Mecklenburg-Vorpommern": "mv",
    "Niedersachsen": "ni",
    "Nordrhein-Westfalen": "nw",
    "Rheinland-Pfalz": "rp",
    "Saarland": "sl",
    "Sachsen": "sn",
    "Sachsen-Anhalt": "st",
    "Schleswig-Holstein": "sh",
    "Thüringen": "th",
}


def plain(raw: str) -> str:
    text = re.sub(r"(?is)<script[\s\S]*?</script>", " ", raw)
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
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", text):
        return float(text.replace(".", ""))
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


def extract_opus(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    car = pair(
        r"inklusive moms.{0,1200}?Personbil max 3 ?500 kg från (\d[\d ]*) kr (\d[\d ]*) kr",
        text,
    )
    if car:
        found["se-opus-car"] = car[0]
        found["se-opus-car-retest"] = car[1]
    motorcycle = first(r"inklusive moms.{0,2200}?MC från (\d[\d ]*) kr", text)
    if motorcycle is not None:
        found["se-opus-motorcycle"] = motorcycle
    return found


def extract_besikta(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    retest = first(
        r"Personbil förbokad och förbetald Max 3 ?500 kg Varierar.*?(\d+) kr",
        text,
    )
    if retest is not None:
        found["se-besikta-car-retest"] = retest
    heavy = pair(r"Personbil 3 501 kg - (\d[\d ]*) kr (\d[\d ]*) kr", text)
    if heavy:
        found["se-besikta-heavy"] = heavy[0]
        found["se-besikta-heavy-retest"] = heavy[1]
    motorcycle = first(r"MC/Moped från (\d[\d ]*) kr", text)
    if motorcycle is not None:
        found["se-besikta-motorcycle"] = motorcycle
    return found


def extract_carspect(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    retest = first(
        r"Personbil Max 3500 kg Varierar mellan stationer och dag samt tid på dygnet (\d+) kr",
        text,
    )
    if retest is not None:
        found["se-carspect-car-retest"] = retest
    return found


def extract_bilprovningen(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    retest = first(r"Personbil, max totalvikt 3 500 kg Efterkontroll (\d+) kr", text)
    if retest is not None:
        found["se-bilprovningen-car-retest"] = retest
    heavy = first(r"Personbil, över 3 500 kg Kontrollbesiktning (\d+) kr", text)
    heavy_retest = first(r"Personbil, över 3 500 kg Efterkontroll (\d+) kr", text)
    if heavy is not None:
        found["se-bilprovningen-heavy"] = heavy
    if heavy_retest is not None:
        found["se-bilprovningen-heavy-retest"] = heavy_retest
    motorcycle = first(r"Motorcykel Kontrollbesiktning Från (\d+) kr", text)
    motorcycle_retest = first(r"Motorcykel Efterkontroll (\d+) kr", text)
    if motorcycle is not None:
        found["se-bilprovningen-motorcycle"] = motorcycle
    if motorcycle_retest is not None:
        found["se-bilprovningen-motorcycle-retest"] = motorcycle_retest
    return found


def extract_snap(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    car = first(r"Personbil og liten varebil\D{0,160}?(\d[\d ]+) kr", text)
    van = first(r"Stor varebil og bobil\D{0,160}?(\d[\d ]+) kr", text)
    retest = first(r"etterkontroll for kun (\d+) kr", text)
    if car is not None:
        found["no-snap-car"] = car
    if van is not None:
        found["no-snap-van"] = van
    if retest is not None:
        found["no-snap-retest"] = retest
    return found


def extract_applus(url: str, text: str) -> dict[str, float]:
    hall = ""
    for slug in ("herlev", "odder", "hilleroed"):
        if f"/{slug}" in url:
            hall = slug
    if not hall:
        return {}
    found: dict[str, float] = {}
    periodic = pair(
        r"Periodisk syn, person-/varebil på maks\. 3\.500 kg (\d+) DKK (\d+) DKK",
        text,
    )
    if periodic:
        found[f"dk-{hall}-car"] = periodic[0]
        found[f"dk-{hall}-car-retest"] = periodic[1]
    booked = first(
        r"Bookingpris, periodisk bilsyn, maks\. 3\.500 kg \(KUN ved booking\) (\d+) DKK",
        text,
    )
    if booked is not None:
        found[f"dk-{hall}-car-booked"] = booked
    motorcycle = first(r"Motorcykel og knallert (\d+) DKK", text)
    if motorcycle is not None:
        found[f"dk-{hall}-motorcycle"] = motorcycle
    return found


def german_fee(section: str) -> tuple[float | None, float | None]:
    window = section[:4000]
    mehr = re.search(r"Mehrspurige Kfz\s*(?:\||\s)\s*(\d+,\d{2})", window)
    pkw = re.search(r"(?:\|\s*)?PKW\s*(?:\||\s)\s*(\d+,\d{2})", window)
    inspection = amount((mehr or pkw).group(1)) if (mehr or pkw) else None
    emissions_row = re.search(
        r"HU inkl\. AU mit Endrohrmessung\s*(?:\||\s)\s*(\d+,\d{2})",
        section[:6000],
    )
    emissions_pkw = re.search(r"PKW inkl\. AU\s*(?:\||\s)\s*(\d+,\d{2})", window)
    emissions = amount((emissions_row or emissions_pkw).group(1)) if (emissions_row or emissions_pkw) else None
    return inspection, emissions


def extract_tuv(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    parts = re.split(r"Was kostet die Hauptuntersuchung \(HU\) (?:in |im )", text)
    for part in parts[1:]:
        state = part.split("?", 1)[0].strip()
        slug = STATES.get(state)
        if not slug:
            continue
        inspection, emissions = german_fee(part)
        if inspection is not None:
            found[f"de-{slug}-car"] = inspection
        if emissions is not None:
            found[f"de-{slug}-car-emissions"] = emissions
    return found


def extract_eivissa(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    car = first(r"TURISMOS Y VEHÍCULOS LIGEROS.{0,80}?(\d+,\d{2})\s*€", text)
    motorcycle = first(r"CICLOMOTORES Y MOTOS.{0,80}?(\d+,\d{2})\s*€", text)
    heavy = first(r"VEHÍCULOS PESADOS.{0,80}?(\d+,\d{2})\s*€", text)
    if car is not None:
        found["es-eivissa-car"] = car
    if motorcycle is not None:
        found["es-eivissa-motorcycle"] = motorcycle
    if heavy is not None:
        found["es-eivissa-heavy"] = heavy
    return found


def extract_mot(text: str) -> dict[str, float]:
    found: dict[str, float] = {}
    car = first(r"maximum fee for a car is £(\d+\.\d{2})", text)
    motorcycle = first(r"£(\d+\.\d{2}) for a standard motorcycle", text)
    van = first(
        r"over 3,000kg up to 3,500kg design gross weight\).{0,120}?£(\d+\.\d{2})",
        text,
    )
    if car is not None:
        found["gb-mot-car"] = car
    if motorcycle is not None:
        found["gb-mot-motorcycle"] = motorcycle
    if van is not None:
        found["gb-mot-van"] = van
    return found


def extract(url: str, text: str) -> dict[str, float]:
    if "opus.se" in url:
        return extract_opus(text)
    if "besikta.se" in url:
        return extract_besikta(text)
    if "carspect.se" in url:
        return extract_carspect(text)
    if "bilprovningen.se" in url:
        return extract_bilprovningen(text)
    if "snapdrive.no" in url:
        return extract_snap(text)
    if "applusbilsyn.dk" in url:
        return extract_applus(url, text)
    if "tuvsud.com" in url:
        return extract_tuv(text)
    if "conselldeivissa.es" in url:
        return extract_eivissa(text)
    if "gov.uk" in url:
        return extract_mot(text)
    return {}


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
            "A row stays only when the station or the authority page published the amount. "
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
    opus = extract_opus(
        "exklusive moms Personbil max 3 500 kg från 559 kr 319 kr "
        "inklusive moms Personbil max 3 500 kg från 699 kr 399 kr MC från 699 kr 399 kr"
    )
    assert opus["se-opus-car"] == 699, opus
    assert opus["se-opus-car-retest"] == 399
    snap = extract_snap(
        "Personbil og liten varebil 1 390 kr standardpris 1 250 kr for medlemmer "
        "Stor varebil og bobil 1 645 kr etterkontroll for kun 174 kr"
    )
    assert snap == {"no-snap-car": 1390, "no-snap-van": 1645, "no-snap-retest": 174}, snap
    mot = extract_mot(
        "The maximum fee for a car is £54.85 and £29.65 for a standard motorcycle. "
        "over 3,000kg up to 3,500kg design gross weight) 4 3 £58.60"
    )
    assert mot == {"gb-mot-car": 54.85, "gb-mot-motorcycle": 29.65, "gb-mot-van": 58.60}, mot
    hall = extract_applus(
        "https://applusbilsyn.dk/synshal/herlev/",
        "Periodisk syn, person-/varebil på maks. 3.500 kg 640 DKK 440 DKK "
        "Bookingpris, periodisk bilsyn, maks. 3.500 kg (KUN ved booking) 490 DKK "
        "Motorcykel og knallert 570 DKK",
    )
    assert hall["dk-herlev-car"] == 640 and hall["dk-herlev-car-booked"] == 490
    tuv = extract_tuv(
        "Was kostet die Hauptuntersuchung (HU) in Baden-Württemberg? "
        "Mehrspurige Kfz 63,30 HU inkl. AU mit Endrohrmessung 163,00 "
        "Was kostet die Hauptuntersuchung (HU) in Berlin? PKW 101,90 PKW inkl. AU 160,00"
    )
    assert tuv["de-bw-car"] == 63.30 and tuv["de-be-car"] == 101.90, tuv
    eivissa = extract_eivissa(
        "CICLOMOTORES Y MOTOS Todas 16,18 € TURISMOS Y VEHÍCULOS LIGEROS Todos 32,18 € "
        "VEHÍCULOS PESADOS + de 3500Kg Todos 64,18 €"
    )
    assert eivissa == {
        "es-eivissa-car": 32.18,
        "es-eivissa-motorcycle": 16.18,
        "es-eivissa-heavy": 64.18,
    }, eivissa
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

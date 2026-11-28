#!/usr/bin/env python3
"""Collect car-repair workshops from OpenStreetMap.

Documented tag: shop=car_repair
https://wiki.openstreetmap.org/wiki/Tag:shop%3Dcar_repair

The address is copied from addr:* only. When addr:city is empty, the city is
the containing municipality (admin_level 7 or 8, short_name when the map has
one). A state or county name is not used as the city. Workshops with no price
stay in the list: this tag does not carry a price.
"""

from __future__ import annotations

import csv
import io
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ENDPOINT = "https://overpass.openstreetmap.fr/api/interpreter"
USER_AGENT = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
OUT = Path(__file__).resolve().parents[2] / "data" / "workshops"
CHECKED_AT = "2026-11-28"
BATCH = 25

COUNTRIES = [
    "SE", "NO", "DK", "FI", "IS",
    "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "EE", "ES",
    "FO", "FR", "GB", "GI", "GR", "HR", "HU", "IE", "IT", "LI", "LT", "LU",
    "LV", "MC", "MD", "ME", "MK", "MT", "NL", "PL", "PT", "RO", "RS", "SI",
    "SK", "SM", "UA", "VA", "XK",
    "AG", "AR", "BB", "BO", "BR", "BS", "BZ", "CA", "CL", "CO", "CR", "CU", "DM", "DO",
    "EC", "GD", "GF", "GL", "GT", "GY", "HN", "HT", "JM", "KN", "LC", "MX", "NI", "PA",
    "PE", "PR", "PY", "SR", "SV", "TT", "US", "UY", "VC", "VE", "VI",
]


def choose_city(areas: list[dict[str, str]]) -> str:
    usable: list[tuple[int, str]] = []
    for area in areas:
        label = area["short"] or area["name"]
        if not area["short"] and area["name"].endswith(" kommun"):
            label = area["name"][: -len(" kommun")]
        folded = label.casefold()
        if not label:
            continue
        if any(word in folded for word in ("county", "parish", "arrondissement", "community board", "quartier")):
            continue
        usable.append((int(area["level"]), label))
    local = [item for item in usable if item[0] in (7, 8)]
    if local:
        return max(local, key=lambda item: item[0])[1]
    coarse = [item for item in usable if item[0] in (4, 5, 6)]
    if coarse:
        return min(coarse, key=lambda item: item[0])[1]
    return ""


def self_check() -> None:
    solna = choose_city([{"level": "7", "name": "Solna kommun", "short": "Solna"}])
    berlin = choose_city(
        [
            {"level": "4", "name": "Berlin", "short": ""},
            {"level": "9", "name": "Friedrichshain-Kreuzberg", "short": ""},
        ]
    )
    paris = choose_city(
        [
            {"level": "8", "name": "Paris", "short": ""},
            {"level": "4", "name": "Île-de-France", "short": ""},
        ]
    )
    county = choose_city([{"level": "6", "name": "New York County", "short": ""}])
    if (solna, berlin, paris, county) != ("Solna", "Berlin", "Paris", ""):
        raise SystemExit(f"city choice failed: {(solna, berlin, paris, county)}")


def fetch(query: str) -> str:
    request = urllib.request.Request(
        ENDPOINT,
        data=query.encode(),
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=200) as response:
        return response.read().decode("utf-8", "replace")


def clean(value: str, limit: int) -> str:
    return " ".join(value.replace("\x00", " ").split())[:limit]


def https_website(value: str) -> str:
    text = clean(value, 300)
    if text.startswith("https://") and " " not in text:
        return text
    return ""


def read_csv(body: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(body), delimiter="|"))


def shop_query(country: str) -> str:
    return f"""
[out:csv(::type, ::id, name, brand, operator, "addr:housenumber", "addr:street", "addr:postcode", "addr:city", website; true; "|")][timeout:180];
area["ISO3166-1"="{country}"][admin_level=2]->.a;
nwr["shop"="car_repair"](area.a);
out;
"""


def parse_shops(body: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, fields in enumerate(read_csv(body)):
        if index == 0 or len(fields) < 10:
            continue
        kind, osm_id, name, brand, operator, number, street, postcode, city, website = fields[:10]
        if kind not in {"node", "way", "relation"} or not osm_id.isdigit():
            continue
        label = clean(name, 120) or clean(brand, 120) or clean(operator, 120)
        if not label:
            continue
        row_id = f"{kind}/{osm_id}"
        if row_id in seen:
            continue
        seen.add(row_id)
        rows.append(
            {
                "id": row_id,
                "name": label,
                "street": clean(" ".join(part for part in (number.strip(), street.strip()) if part.strip()), 160),
                "postcode": clean(postcode, 16),
                "city": clean(city, 80),
                "website": https_website(website),
                "sourceUrl": f"https://www.openstreetmap.org/{kind}/{osm_id}",
            }
        )
    return rows


def area_query(ids: list[str]) -> str:
    groups: dict[str, list[str]] = {"node": [], "way": [], "relation": []}
    for row_id in ids:
        kind, osm_id = row_id.split("/", 1)
        groups[kind].append(osm_id)
    statements = [
        f"{kind}(id:{','.join(values)});"
        for kind, values in groups.items()
        if values
    ]
    return f"""
[out:csv(::type, ::id, name, short_name, admin_level; true; "|")][timeout:90];
(
  {" ".join(statements)}
);
foreach(
  out;
  is_in;
  area._[boundary=administrative][admin_level~"^[4-8]$"];
  out;
);
"""


def cities_for(ids: list[str]) -> dict[str, str]:
    body = fetch(area_query(ids))
    if not body.startswith("@type"):
        return {}
    found: dict[str, str] = {}
    current: str | None = None
    areas: list[dict[str, str]] = []

    def flush() -> None:
        nonlocal current, areas
        if current is not None:
            city = choose_city(areas)
            if city:
                found[current] = city
        current = None
        areas = []

    for index, fields in enumerate(read_csv(body)):
        if index == 0 or len(fields) < 5:
            continue
        kind, osm_id, name, short_name, level = fields[:5]
        if kind in {"node", "way", "relation"} and osm_id.isdigit():
            flush()
            current = f"{kind}/{osm_id}"
            continue
        if kind == "area" and level.isdigit():
            areas.append({"level": level, "name": name, "short": short_name})
    flush()
    return found


def write_country(country: str, rows: list[dict[str, str]], city_pass: bool) -> None:
    rows.sort(key=lambda row: (row["city"].casefold(), row["name"].casefold(), row["id"]))
    payload = {
        "country": country,
        "tag": "shop=car_repair",
        "source": "https://wiki.openstreetmap.org/wiki/Tag:shop%3Dcar_repair",
        "checkedAt": CHECKED_AT,
        "cityPass": city_pass,
        "rows": rows,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{country}.json"
    temporary = OUT / f".{country}.json.tmp"
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(target)


def load_country(country: str) -> tuple[list[dict[str, str]], bool] | None:
    target = OUT / f"{country}.json"
    if not target.exists():
        return None
    payload = json.loads(target.read_text(encoding="utf-8"))
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return None
    return rows, bool(payload.get("cityPass"))


def fill_cities(rows: list[dict[str, str]]) -> bool:
    missing = [row["id"] for row in rows if not row["city"]]
    ok = True
    by_id = {row["id"]: row for row in rows}
    for start in range(0, len(missing), BATCH):
        batch = missing[start : start + BATCH]
        try:
            found = cities_for(batch)
        except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError) as exc:
            print(f"  batch fail {exc}", flush=True)
            ok = False
            time.sleep(5)
            continue
        for row_id, city in found.items():
            if row_id in by_id and not by_id[row_id]["city"]:
                by_id[row_id]["city"] = clean(city, 80)
        print(f"  cities {start + len(batch)}/{len(missing)}", flush=True)
        time.sleep(1)
    return ok


def collect(country: str) -> None:
    loaded = load_country(country)
    if loaded is not None and loaded[1]:
        print(f"skip {country}", flush=True)
        return
    if loaded is None:
        try:
            body = fetch(shop_query(country))
        except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError) as exc:
            print(f"fail {country} {exc}", flush=True)
            return
        if not body.startswith("@type"):
            print(f"fail {country} unexpected", flush=True)
            return
        rows = parse_shops(body)
        write_country(country, rows, False)
        print(f"listed {country} {len(rows)}", flush=True)
        time.sleep(2)
    else:
        rows = loaded[0]
    if not rows:
        write_country(country, rows, True)
        print(f"ok {country} 0", flush=True)
        return
    filled = fill_cities(rows)
    write_country(country, rows, filled)
    named = sum(1 for row in rows if row["city"])
    print(f"ok {country} {len(rows)} cities {named}", flush=True)


def main() -> None:
    self_check()
    for country in COUNTRIES:
        collect(country)


if __name__ == "__main__":
    main()

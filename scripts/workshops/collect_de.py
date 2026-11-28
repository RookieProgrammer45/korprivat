#!/usr/bin/env python3
"""Collect German car-repair workshops from the Germany OpenStreetMap database.

Geofabrik taginfo for Germany records shop=car_repair (24,483 objects on
2026-11-27). The country-wide area lookup used for other countries returned
an empty file, so each Bundesland is read from the German Overpass server.
Addresses still come only from addr:* and the mapped municipality.
https://taginfo.geofabrik.de/europe:germany/tags/shop=car_repair
https://wiki.openstreetmap.org/wiki/DE:Tag:shop%3Dcar_repair
"""

from __future__ import annotations

import sys
import time
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import collect

# German Overpass instance. The country collector keeps the French mirror.
collect.ENDPOINT = "https://lz4.overpass-api.de/api/interpreter"
FALLBACK = "https://overpass.openstreetmap.fr/api/interpreter"

# OSM relation id + 3_600_000_000 is the Overpass area id.
STATES = [
    ("Baden-Württemberg", 3600062611),
    ("Bayern", 3602145268),
    ("Berlin", 3600062422),
    ("Brandenburg", 3600062504),
    ("Bremen", 3600062718),
    ("Hamburg", 3600062782),
    ("Hessen", 3600062650),
    ("Mecklenburg-Vorpommern", 3600028322),
    ("Niedersachsen", 3600062771),
    ("Nordrhein-Westfalen", 3600062761),
    ("Rheinland-Pfalz", 3600062341),
    ("Saarland", 3600062372),
    ("Sachsen", 3600062467),
    ("Sachsen-Anhalt", 3600062607),
    ("Schleswig-Holstein", 3600051529),
    ("Thüringen", 3600062366),
]


def shop_query(area_id: int) -> str:
    return f"""
[out:csv(::type, ::id, name, brand, operator, "addr:housenumber", "addr:street", "addr:postcode", "addr:city", website; true; "|")][timeout:180];
area({area_id})->.a;
nwr["shop"="car_repair"](area.a);
out;
"""


def fetch_state(name: str, area_id: int) -> str:
    query = shop_query(area_id)
    last_error: Exception | None = None
    for endpoint in (collect.ENDPOINT, FALLBACK):
        collect.ENDPOINT = endpoint
        for _attempt in range(2):
            try:
                body = collect.fetch(query)
            except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError) as exc:
                last_error = exc
                print(f"  {name} retry {exc}", flush=True)
                time.sleep(8)
                continue
            if body.startswith("@type"):
                return body
            last_error = RuntimeError("unexpected")
            time.sleep(5)
    raise RuntimeError(f"{name} failed: {last_error}")


def listed_rows() -> list[dict[str, str]] | None:
    loaded = collect.load_country("DE")
    if loaded is None:
        return None
    rows, city_pass = loaded
    if rows and not city_pass:
        return rows
    return None


def list_states() -> list[dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    for name, area_id in STATES:
        body = fetch_state(name, area_id)
        found = collect.parse_shops(body)
        for row in found:
            merged.setdefault(row["id"], row)
        rows = list(merged.values())
        collect.write_country("DE", rows, False)
        print(f"listed {name} {len(found)} total {len(rows)}", flush=True)
        time.sleep(2)
    return list(merged.values())


def main() -> None:
    collect.self_check()
    rows = listed_rows()
    if rows is None:
        rows = list_states()
    else:
        print(f"resume DE {len(rows)}", flush=True)
    filled = collect.fill_cities(rows)
    collect.write_country("DE", rows, filled)
    named = sum(1 for row in rows if row["city"])
    print(f"ok DE {len(rows)} cities {named} filled {filled}", flush=True)


if __name__ == "__main__":
    main()

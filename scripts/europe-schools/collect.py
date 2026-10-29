# Builds data/europe-schools/schools.json from public lists that name each
# school's own website. OpenStreetMap provides the website tag. France also
# uses the Sécurité routière labelled-school file when that file gives the
# school's own site. Prices are left empty for the OpenAI extract.
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalogue.non_driving_school import is_non_driving_school

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "europe-schools" / "schools.json"
CACHE = Path("/tmp/osm-eu")
FRENCH_CSV = "https://autoecoles.securite-routiere.gouv.fr/sites/default/files/certified-schools/auto-ecoles.csv"

# ISO country, currency, catalogue language, English country name.
COUNTRIES = [
    ("ES", "EUR", "es", "Spain"),
    ("FR", "EUR", "fr", "France"),
    ("DE", "EUR", "de", "Germany"),
    ("IT", "EUR", "it", "Italy"),
    ("PL", "PLN", "pl", "Poland"),
    ("AT", "EUR", "de", "Austria"),
    ("BE", "EUR", "nl", "Belgium"),
    ("NL", "EUR", "nl", "Netherlands"),
    ("PT", "EUR", "pt", "Portugal"),
    ("IE", "EUR", "en", "Ireland"),
    ("LU", "EUR", "fr", "Luxembourg"),
    ("CH", "CHF", "de", "Switzerland"),
    ("CZ", "CZK", "cs", "Czechia"),
    ("SK", "EUR", "sk", "Slovakia"),
    ("HU", "HUF", "hu", "Hungary"),
    ("RO", "RON", "ro", "Romania"),
    ("BG", "BGN", "bg", "Bulgaria"),
    ("HR", "EUR", "hr", "Croatia"),
    ("SI", "EUR", "sl", "Slovenia"),
    ("GR", "EUR", "el", "Greece"),
    ("CY", "EUR", "el", "Cyprus"),
    ("MT", "EUR", "en", "Malta"),
    ("EE", "EUR", "et", "Estonia"),
    ("LV", "EUR", "lv", "Latvia"),
    ("LT", "EUR", "lt", "Lithuania"),
]

SKIP_HOSTS = (
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "youtube.com",
    "linkedin.com",
    "google.com",
    "goo.gl",
    "pagesjaunes.fr",
    "yelp.com",
    "tripadvisor.",
    "vroomvroom.fr",
    "gelbeseiten.de",
    "dasoertliche.de",
    "cylex.",
    "wikipedia.org",
    "wikidata.org",
    "openstreetmap.org",
    "linktr.ee",
    "wa.me",
)

EXACT_SKIP_HOSTS = {
    "dgt.es",
    "fahrschulen.de",
    "guidaevai.com",
    "branchenbuch.meinestadt.de",
}


def slug(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-") or "school"


def host_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def clean_website(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip()
    if not raw or raw.lower().startswith(("mailto:", "tel:", "javascript:")):
        return None
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    try:
        parsed = urlparse(raw)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    host = host_of(parsed.geturl())
    if host in EXACT_SKIP_HOSTS or any(part in host for part in SKIP_HOSTS):
        return None
    return parsed.geturl().split("#")[0]


def city_of(tags: dict) -> str:
    for key in ("addr:city", "addr:town", "addr:municipality", "addr:village"):
        value = (tags.get(key) or "").strip()
        if value:
            return value
    return ""


def curl_overpass(query: str, dest: Path) -> dict | None:
    if dest.exists() and dest.stat().st_size > 1000:
        try:
            cached = json.loads(dest.read_text())
            if "elements" in cached:
                return cached
        except json.JSONDecodeError:
            pass
    for attempt in range(2):
        for endpoint in (
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.openstreetmap.fr/api/interpreter",
        ):
            result = subprocess.run(
                [
                    "curl",
                    "-sS",
                    "--max-time",
                    "120",
                    "-A",
                    "DriveLinkUp catalogue research",
                    "-o",
                    str(dest),
                    "-w",
                    "%{http_code}",
                    "--data-urlencode",
                    f"data={query}",
                    endpoint,
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            code_http = (result.stdout or "").strip()
            if code_http == "200" and dest.exists():
                try:
                    data = json.loads(dest.read_text())
                except json.JSONDecodeError:
                    data = None
                if data and "elements" in data:
                    return data
            print(f"attempt {attempt + 1} http {code_http} {dest.name} {endpoint}", flush=True)
            if code_http in {"429", "502", "000", ""}:
                time.sleep(20)
    return None


BBOX = {
    "ES": (36.0, -9.5, 43.8, 3.4),
    "FR": (41.3, -5.2, 51.1, 9.6),
    "DE": (47.2, 5.8, 55.1, 15.1),
    "IT": (36.6, 6.6, 47.1, 18.6),
    "PL": (49.0, 14.1, 54.9, 24.2),
    "AT": (46.3, 9.5, 49.1, 17.2),
    "BE": (49.5, 2.5, 51.6, 6.4),
    "NL": (50.7, 3.2, 53.6, 7.3),
    "PT": (36.9, -9.6, 42.2, -6.1),
    "IE": (51.4, -10.5, 55.5, -5.4),
    "LU": (49.4, 5.7, 50.2, 6.6),
    "CH": (45.8, 5.9, 47.9, 10.5),
    "CZ": (48.5, 12.0, 51.1, 18.9),
    "SK": (47.7, 16.8, 49.7, 22.6),
    "HU": (45.7, 16.1, 48.6, 22.9),
    "RO": (43.6, 20.2, 48.3, 29.8),
    "BG": (41.2, 22.3, 44.3, 28.7),
    "HR": (42.3, 13.4, 46.6, 19.5),
    "SI": (45.4, 13.3, 46.9, 16.6),
    "GR": (34.8, 19.3, 41.8, 28.3),
    "CY": (34.5, 32.2, 35.8, 34.6),
    "MT": (35.8, 14.1, 36.1, 14.6),
    "EE": (57.5, 21.7, 59.7, 28.2),
    "LV": (55.6, 20.9, 58.1, 28.3),
    "LT": (53.9, 20.9, 56.5, 26.9),
}


def overpass(code: str) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / f"{code}.tags.json"
    if dest.exists() and dest.stat().st_size > 1000:
        try:
            cached = json.loads(dest.read_text())
            if cached.get("elements") and cached["elements"][0].get("type") != "count":
                return cached
        except json.JSONDecodeError:
            pass
    if __import__("os").environ.get("EUROPE_OFFLINE"):
        return {"elements": []}
    south, west, north, east = BBOX[code]
    # Split wide countries so a single query stays small enough for the public server.
    tiles = []
    mid_lat = (south + north) / 2
    mid_lon = (west + east) / 2
    if (north - south) * (east - west) > 30:
        tiles = [
            (south, west, mid_lat, mid_lon),
            (south, mid_lon, mid_lat, east),
            (mid_lat, west, north, mid_lon),
            (mid_lat, mid_lon, north, east),
        ]
    else:
        tiles = [(south, west, north, east)]
    elements = []
    for index, tile in enumerate(tiles):
        query = (
            f"[out:json][timeout:80];"
            f'nwr["amenity"="driving_school"]["website"]({tile[0]},{tile[1]},{tile[2]},{tile[3]});'
            f"out tags center;"
        )
        part = curl_overpass(query, CACHE / f"{code}-{index}.json")
        if part is None:
            print(f"{code} tile {index} unavailable", flush=True)
            continue
        elements.extend(part.get("elements", []))
        time.sleep(3)
    combined = {"elements": elements}
    dest.write_text(json.dumps(combined))
    return combined


def from_osm(code: str, currency: str) -> list[dict]:
    data = overpass(code)
    rows = []
    for element in data.get("elements", []):
        tags = element.get("tags") or {}
        country_tag = (tags.get("addr:country") or "").strip().upper()
        if country_tag and country_tag not in {code, "D" if code == "DE" else code}:
            continue
        website = clean_website(tags.get("website") or tags.get("contact:website"))
        name = (tags.get("name") or "").strip()
        city = city_of(tags)
        if not website or not name or not city:
            continue
        rows.append(
            {
                "country": code,
                "name": name,
                "city": city,
                "website": website,
                "currency": currency,
                "postcode": (tags.get("addr:postcode") or "").strip(),
                "heavy": heavy_from_license_classes(tags.get("license_classes")),
            }
        )
    print(f"{code} osm {len(data.get('elements', []))} kept {len(rows)}", flush=True)
    if not os.environ.get("EUROPE_OFFLINE"):
        time.sleep(8)
    return rows


HEAVY_FLAGS = (
    ("C1_flag", "C1"),
    ("C1E_flag", "C1E"),
    ("C_flag", "C"),
    ("CE_flag", "CE"),
    ("D1_flag", "D1"),
    ("D1E_flag", "D1E"),
    ("D_flag", "D"),
    ("DE_flag", "DE"),
)


def flagged(record: dict, key: str) -> bool:
    return (record.get(key) or "").upper() == "TRUE"


def heavy_codes(record: dict) -> list[str]:
    return [code for key, code in HEAVY_FLAGS if flagged(record, key)]


def heavy_from_license_classes(value: str | None) -> list[str]:
    # OpenStreetMap documents license_classes as the driver's licence classes,
    # for example A1;A;B;BE;C. Only a class written in that tag is stored.
    if not value:
        return []
    found: list[str] = []
    for match in re.finditer(r"\b(C1E|C1|CE|C|D1E|D1|DE|D)\b", value.upper()):
        code = match.group(1)
        if code not in found:
            found.append(code)
    order = [code for _key, code in HEAVY_FLAGS]
    return [code for code in order if code in found]


def french_official() -> list[dict]:
    dest = CACHE / "fr-official.csv"
    if not dest.exists():
        subprocess.run(
            ["curl", "-sS", "--max-time", "60", "-A", "DriveLinkUp catalogue research", "-o", str(dest), FRENCH_CSV],
            check=True,
        )
    text = dest.read_text(errors="replace")
    rows = []
    for record in csv.DictReader(io.StringIO(text), delimiter=";"):
        car = flagged(record, "B_flag")
        heavy = heavy_codes(record)
        if not car and not heavy:
            continue
        website = clean_website(record.get("aue_siteinternet"))
        name = (record.get("aue_raisonsociale") or "").strip()
        city = (record.get("aue_commune") or "").strip().title()
        if not website or not name or not city:
            continue
        rows.append(
            {
                "country": "FR",
                "name": name,
                "city": city,
                "website": website,
                "currency": "EUR",
                "postcode": (record.get("aue_codepostal") or "").strip(),
                "categories": ["B"] if car else [],
                "heavy": heavy,
            }
        )
    print(f"FR official kept {len(rows)}", flush=True)
    return rows


def prefer_country(schools: list[dict]) -> list[dict]:
    # Map tiles overlap borders, so the same website can land in two countries.
    # Keep the country where that city is more common. Germany's wide tiles lose
    # a tie to the neighbour. Zagreb is Croatia even though the Croatia query failed.
    forced = {
        "zagreb": "HR",
        "sisak": "HR",
        "nedelišće": "HR",
        "čakovec": "HR",
        "ózd": "HU",
        "miskolc": "HU",
        "nyíregyháza": "HU",
        "crasna": "RO",
    }
    by_city: dict[str, dict[str, int]] = {}
    for school in schools:
        bucket = by_city.setdefault(school["city"].casefold(), {})
        bucket[school["country"]] = bucket.get(school["country"], 0) + 1
    by_site: dict[str, list[dict]] = {}
    for school in schools:
        if school["city"].casefold() == "tirana":
            continue
        by_site.setdefault(school["website"], []).append(school)
    kept = []
    for rows in by_site.values():
        city = rows[0]["city"].casefold()
        if city in forced:
            country = forced[city]
            chosen = [row for row in rows if row["country"] == country] or [rows[0]]
            chosen[0]["country"] = country
            chosen[0]["currency"] = "EUR" if country == "HR" else chosen[0]["currency"]
            kept.append(chosen[0])
            continue
        counts = by_city[city]
        def rank(row: dict) -> tuple[int, int, str]:
            germany_penalty = 1 if row["country"] == "DE" and len(counts) > 1 else 0
            return (-counts.get(row["country"], 0), germany_penalty, row["country"])
        winner = sorted(rows, key=rank)[0]
        kept.append(winner)
    return kept


def belgium_language(row: dict) -> str:
    host = host_of(row["website"])
    if host.endswith(".fr"):
        return "fr"
    if host.endswith(".nl"):
        return "nl"
    postcode = row.get("postcode") or ""
    if postcode.isdigit():
        number = int(postcode)
        if 1300 <= number <= 1499 or 4000 <= number <= 7999:
            return "fr"
    return "nl"


def main() -> None:
    language = {code: lang for code, _currency, lang, _name in COUNTRIES}
    seen: set[tuple[str, str, str]] = set()
    schools = []
    for code, currency, _lang, _name in COUNTRIES:
        batch = french_official() if code == "FR" else []
        batch.extend(from_osm(code, currency))
        for row in batch:
            if "taxi" in row["name"].casefold():
                continue
            if is_non_driving_school(row["name"], row["website"]):
                continue
            key = (code, host_of(row["website"]), row["city"].casefold())
            if key in seen:
                continue
            seen.add(key)
            digest = hashlib.sha1(row["website"].encode()).hexdigest()[:6]
            lang = belgium_language(row) if code == "BE" else language[code]
            schools.append(
                {
                    "id": f"eu{code.lower()}{digest}-{slug(row['name'])}"[:80],
                    "country": code,
                    "name": row["name"],
                    "city": row["city"],
                    "website": row["website"],
                    "categories": row.get("categories", ["B"]),
                    "heavy": row.get("heavy", []),
                    "email": None,
                    "phone": None,
                    "lessonPrice": None,
                    "lessonMinutes": None,
                    "currency": currency,
                    "language": lang,
                    "sourceUrl": row["website"],
                    "checkedAt": "2026-10-28",
                    "websiteStatus": "LISTED",
                }
            )
    schools = prefer_country(schools)
    facts = {code: (currency, lang) for code, currency, lang, _name in COUNTRIES}
    for school in schools:
        digest = hashlib.sha1(school["website"].encode()).hexdigest()[:6]
        school["id"] = f"eu{school['country'].lower()}{digest}-{slug(school['name'])}"[:80]
        currency, lang = facts[school["country"]]
        school["currency"] = currency
        if school["country"] != "BE":
            school["language"] = lang
    by_country: dict[str, int] = {}
    for school in schools:
        by_country[school["country"]] = by_country.get(school["country"], 0) + 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": "2026-10-28",
                    "note": "Schools whose own website is published on OpenStreetMap, plus French labelled schools whose own site is in the Sécurité routière file. Lesson prices are filled by the OpenAI extract. Nothing here is a verified permit. Directory and social-profile links are not stored as the school website.",
                    "counts": by_country,
                },
                "schools": schools,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    print("wrote", len(schools), by_country, flush=True)


if __name__ == "__main__":
    main()

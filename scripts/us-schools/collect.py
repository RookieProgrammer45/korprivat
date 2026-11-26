# Builds data/us-schools/schools.json from the OpenStreetMap state extracts
# published by Geofabrik. A school is kept when the map point has the school's
# own website and a city. A car school is category B. A truck or
# bus category is stored only when that point's name, driving_school tag, or
# license_classes says so. Motorcycle is stored only when the name says
# motorcycle. Lesson prices are left empty. This script does not read or write
# the European catalogue.
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

import osmium

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalogue.non_driving_school import is_non_driving_school

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "us-schools" / "schools.json"
CACHE = Path("/tmp/osm-us")

# slug, postal abbreviation, (south, west, north, east)
STATES = [
    ("alabama", "AL", (30.1, -88.5, 35.0, -84.8)),
    ("alaska", "AK", (51.2, -179.2, 71.5, -129.9)),
    ("arizona", "AZ", (31.3, -114.9, 37.0, -109.0)),
    ("arkansas", "AR", (33.0, -94.7, 36.5, -89.6)),
    ("california", "CA", (32.5, -124.5, 42.1, -114.1)),
    ("colorado", "CO", (37.0, -109.1, 41.0, -102.0)),
    ("connecticut", "CT", (40.9, -73.8, 42.1, -71.8)),
    ("delaware", "DE", (38.4, -75.8, 39.9, -75.0)),
    ("district-of-columbia", "DC", (38.79, -77.12, 39.0, -76.9)),
    ("florida", "FL", (24.5, -87.7, 31.1, -80.0)),
    ("georgia", "GA", (30.3, -85.7, 35.0, -80.8)),
    ("hawaii", "HI", (18.9, -160.3, 22.3, -154.8)),
    ("idaho", "ID", (42.0, -117.3, 49.0, -111.0)),
    ("illinois", "IL", (36.9, -91.6, 42.6, -87.0)),
    ("indiana", "IN", (37.7, -88.1, 41.8, -84.7)),
    ("iowa", "IA", (40.3, -96.7, 43.6, -90.1)),
    ("kansas", "KS", (36.9, -102.1, 40.1, -94.6)),
    ("kentucky", "KY", (36.5, -89.6, 39.2, -81.9)),
    ("louisiana", "LA", (28.9, -94.1, 33.1, -88.8)),
    ("maine", "ME", (43.0, -71.1, 47.5, -66.9)),
    ("maryland", "MD", (37.9, -79.5, 39.8, -75.0)),
    ("massachusetts", "MA", (41.2, -73.6, 42.9, -69.9)),
    ("michigan", "MI", (41.7, -90.5, 48.3, -82.1)),
    ("minnesota", "MN", (43.4, -97.3, 49.4, -89.5)),
    ("mississippi", "MS", (30.1, -91.7, 35.0, -88.1)),
    ("missouri", "MO", (36.0, -95.8, 40.7, -89.1)),
    ("montana", "MT", (44.3, -116.1, 49.1, -104.0)),
    ("nebraska", "NE", (40.0, -104.1, 43.1, -95.3)),
    ("nevada", "NV", (35.0, -120.1, 42.1, -114.0)),
    ("new-hampshire", "NH", (42.7, -72.6, 45.4, -70.6)),
    ("new-jersey", "NJ", (38.9, -75.6, 41.4, -73.9)),
    ("new-mexico", "NM", (31.3, -109.1, 37.0, -103.0)),
    ("new-york", "NY", (40.5, -79.8, 45.1, -71.8)),
    ("north-carolina", "NC", (33.8, -84.4, 36.6, -75.4)),
    ("north-dakota", "ND", (45.9, -104.1, 49.1, -96.5)),
    ("ohio", "OH", (38.4, -84.9, 42.0, -80.5)),
    ("oklahoma", "OK", (33.6, -103.1, 37.1, -94.4)),
    ("oregon", "OR", (41.9, -124.6, 46.3, -116.4)),
    ("pennsylvania", "PA", (39.7, -80.6, 42.3, -74.7)),
    ("rhode-island", "RI", (41.1, -71.9, 42.1, -71.1)),
    ("south-carolina", "SC", (32.0, -83.4, 35.2, -78.5)),
    ("south-dakota", "SD", (42.5, -104.1, 46.0, -96.4)),
    ("tennessee", "TN", (34.9, -90.4, 36.7, -81.6)),
    ("texas", "TX", (25.8, -106.7, 36.6, -93.5)),
    ("utah", "UT", (37.0, -114.1, 42.1, -109.0)),
    ("vermont", "VT", (42.7, -73.5, 45.1, -71.5)),
    ("virginia", "VA", (36.5, -83.7, 39.5, -75.2)),
    ("washington", "WA", (45.5, -124.8, 49.1, -116.9)),
    ("west-virginia", "WV", (37.2, -82.7, 40.7, -77.7)),
    ("wisconsin", "WI", (42.5, -92.9, 47.1, -86.8)),
    ("wyoming", "WY", (40.9, -111.1, 45.1, -104.0)),
]

STATE_BY_LABEL = {slug: slug for slug, _code, _box in STATES}
STATE_BY_LABEL.update({code: slug for slug, code, _box in STATES})
STATE_BY_LABEL.update({slug.replace("-", " "): slug for slug, _code, _box in STATES})
STATE_BY_LABEL["district of columbia"] = "district-of-columbia"
STATE_BY_LABEL["washington dc"] = "district-of-columbia"
STATE_BY_LABEL["washington, d.c."] = "district-of-columbia"

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
    "yelp.com",
    "tripadvisor.",
    "wikipedia.org",
    "wikidata.org",
    "openstreetmap.org",
    "linktr.ee",
    "wa.me",
    "yellowpages.com",
    "mapquest.com",
    "apple.com",
)

HEAVY_ORDER = ["C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE"]
TAXI = re.compile(r"\btaxis?\b", re.I)
CANADA = re.compile(r"\bcanada\b", re.I)
CA_PROVINCES = {
    "on",
    "qc",
    "bc",
    "ab",
    "mb",
    "sk",
    "nb",
    "ns",
    "pe",
    "nl",
    "yt",
    "nt",
    "nu",
    "ontario",
    "quebec",
    "québec",
    "british columbia",
    "alberta",
    "manitoba",
    "saskatchewan",
}
# Cities that sit inside a state bounding box but are in Canada. Kingston is
# left out because New York has a Kingston too.
CA_CITIES = {
    "toronto",
    "mississauga",
    "ottawa",
    "montreal",
    "montréal",
    "vancouver",
    "calgary",
    "edmonton",
    "winnipeg",
    "newmarket",
    "north york",
    "whitby",
    "beamsville",
    "smiths falls",
    "brampton",
    "markham",
    "vaughan",
    "oshawa",
    "hamilton",
    "gatineau",
    "laval",
}
MOTO = re.compile(r"\bmotorcycles?\b", re.I)
HEAVY_NAME = re.compile(r"\b(cdl|trucks?|tractors?|school bus|bus driver)\b", re.I)
CAR_HINT = re.compile(
    r"\b(cars?|teens?|driver'?s?\s*ed|driver education|automobiles?|high school|behind the wheel)\b",
    re.I,
)


def slugify(value: str) -> str:
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
    if any(part in host for part in SKIP_HOSTS):
        return None
    return parsed.geturl().split("#")[0]


def city_of(tags: dict) -> str:
    for key in ("addr:city", "addr:town", "addr:municipality", "addr:village"):
        value = (tags.get(key) or "").strip()
        if value:
            return value
    return ""


def state_slug(value: str | None, fallback: str) -> str:
    label = (value or "").strip().lower().replace(".", "")
    return STATE_BY_LABEL.get(label, fallback)


def heavy_from_text(text: str, license_classes: str) -> list[str]:
    # Only words on this point. A car school is not marked heavy.
    # European class letters are read from license_classes, not from the name,
    # so a name like "C. Smith Driving" is not stored as a truck school.
    found: list[str] = []
    if re.search(r"\b(CLASS\s*A|CDL\s*A|TRACTOR|SEMI-?TRUCK|COMBINATION|18-?WHEELER)\b", text):
        found.append("CE")
    if re.search(r"\b(CLASS\s*B|CDL\s*B|STRAIGHT\s+TRUCK)\b", text):
        found.append("C")
    if re.search(r"\b(SCHOOL\s+BUS|BUS\s+DRIVER|MOTORCOACH|COACH\s+BUS)\b", text):
        found.append("D")
    # A bare C or D in license_classes is a US car class in many states
    # (Massachusetts Class D is an ordinary car licence). Only multi-letter
    # European classes are read from that tag. US Class A/B are handled above.
    for code in re.findall(r"\b(C1E|C1|D1E|D1|DE|CE)\b", license_classes.upper()):
        if code not in found:
            found.append(code)
    if re.search(r"\b(CDL|TRUCK|TRACTOR)\b", text) and "C" not in found and "CE" not in found:
        found.append("C")
    return [code for code in HEAVY_ORDER if code in found]


def classify(name: str, tags: dict) -> tuple[list[str], list[str]] | None:
    if TAXI.search(name) or CANADA.search(name):
        return None
    evidence = " ".join(
        part for part in (name, tags.get("driving_school") or "") if part
    ).upper()
    heavy = heavy_from_text(evidence, tags.get("license_classes") or "")
    categories: list[str] = []
    if MOTO.search(name):
        categories.append("A")
    named_heavy = bool(HEAVY_NAME.search(name))
    named_car = bool(CAR_HINT.search(name))
    if named_heavy and not named_car and "A" not in categories:
        pass
    elif "A" in categories and not named_car and not named_heavy:
        pass
    else:
        categories.append("B")
    if not categories and not heavy:
        return None
    return categories, heavy


def row_from_tags(tags: dict, fallback: str) -> dict | None:
    country_tag = (tags.get("addr:country") or "").strip().upper()
    if country_tag and country_tag not in {"US", "USA"}:
        return None
    state_label = (tags.get("addr:state") or "").strip().lower().replace(".", "")
    if state_label in CA_PROVINCES:
        return None
    website = clean_website(tags.get("website") or tags.get("contact:website"))
    if website and host_of(website).endswith(".ca"):
        return None
    name = (tags.get("name") or "").strip()
    city = city_of(tags)
    if not website or not name or not city or city.casefold() in CA_CITIES:
        return None
    if is_non_driving_school(name, website):
        return None
    classified = classify(name, tags)
    if classified is None:
        return None
    categories, heavy = classified
    return {
        "name": name,
        "city": city,
        "website": website,
        "region": state_slug(tags.get("addr:state"), fallback),
        "categories": categories,
        "heavy": heavy,
    }


def from_pbf(slug: str) -> list[dict]:
    dest = CACHE / f"{slug}.osm.pbf"
    url = f"https://download.geofabrik.de/north-america/us/{slug}-latest.osm.pbf"
    CACHE.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or dest.stat().st_size < 1000:
        result = subprocess.run(
            [
                "curl",
                "-fL",
                "--max-time",
                "900",
                "-A",
                "DriveLinkUp catalogue research",
                "-o",
                str(dest),
                url,
            ],
            check=False,
        )
        if result.returncode != 0 or not dest.exists() or dest.stat().st_size < 1000:
            print(f"{slug} download failed", flush=True)
            dest.unlink(missing_ok=True)
            return []

    rows: list[dict] = []
    processor = osmium.FileProcessor(str(dest)).with_filter(
        osmium.filter.TagFilter(("amenity", "driving_school"))
    )
    for obj in processor:
        tags = {tag.k: tag.v for tag in obj.tags}
        row = row_from_tags(tags, slug)
        if row:
            rows.append(row)
    dest.unlink(missing_ok=True)
    print(f"{slug} kept {len(rows)}", flush=True)
    return rows


def self_check() -> None:
    assert classify("Smith Driving School", {}) == (["B"], [])
    assert classify("Lone Star CDL Training", {}) == ([], ["C"])
    assert classify("Gulf Tractor Trailer School", {}) == ([], ["CE"])
    assert classify("Class A CDL School", {}) == ([], ["CE"])
    assert classify("City Motorcycle School", {}) == (["A"], [])
    assert classify("Taxi Driving School", {}) is None
    car_and_cdl = classify("Austin Car and CDL School", {})
    assert car_and_cdl is not None
    assert car_and_cdl[0] == ["B"]
    assert car_and_cdl[1] == ["C"]
    assert classify("Neighborhood Driving School", {"license_classes": "B"}) == (["B"], [])
    assert classify("Neighborhood Driving School", {"license_classes": "D"}) == (["B"], [])
    assert classify("stallion school of driving", {"license_classes": "c;car"}) == (["B"], [])
    assert "C" not in classify("Neighborhood Driving School", {})[1]


def main() -> None:
    self_check()
    seen: set[tuple[str, str, str]] = set()
    schools = []
    light = 0
    heavy = 0
    for slug, _code, _box in STATES:
        for row in from_pbf(slug):
            key = (host_of(row["website"]), row["city"].casefold(), row["region"])
            if key in seen:
                continue
            seen.add(key)
            digest = hashlib.sha1(
                f"{row['website']}|{row['city'].casefold()}|{row['region']}".encode()
            ).hexdigest()[:6]
            if "B" in row["categories"] or "A" in row["categories"]:
                light += 1
            if row["heavy"]:
                heavy += 1
            schools.append(
                {
                    "id": f"us{digest}-{slugify(row['name'])}"[:80],
                    "country": "US",
                    "region": row["region"],
                    "name": row["name"],
                    "city": row["city"],
                    "website": row["website"],
                    "categories": row["categories"],
                    "heavy": row["heavy"],
                    "email": None,
                    "phone": None,
                    "lessonPrice": None,
                    "lessonMinutes": None,
                    "currency": "USD",
                    "language": "en",
                    "sourceUrl": row["website"],
                    "checkedAt": "2026-10-29",
                    "websiteStatus": "LISTED",
                }
            )
    if not schools:
        raise SystemExit("No US schools collected. The output file was left unchanged.")
    by_region: dict[str, int] = {}
    for school in schools:
        by_region[school["region"]] = by_region.get(school["region"], 0) + 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": "2026-10-29",
                    "note": "US driving schools whose own website and city are on OpenStreetMap. Category B is a car school. A truck or bus category is stored only when that point's name, driving_school tag, or license_classes says so. Motorcycle is stored only when the name says motorcycle. No lesson price is stored. Nothing here is a verified permit.",
                    "light": light,
                    "heavy": heavy,
                    "counts": by_region,
                },
                "schools": schools,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    print("wrote", len(schools), "light", light, "heavy", heavy, flush=True)


if __name__ == "__main__":
    main()

# Builds data/canada-schools/schools.json and data/brazil-schools/schools.json.
# Names and cities come from public official lists (Ontario open data, DETRAN-RJ).
# A website is stored only when it is the school's own site and the page contains
# the school name. One website lookup is reused for every city of the same school.
# Directory and social hosts are skipped. Caps each country at 250. Lesson prices
# are left empty. Nothing here is a verified permit.
from __future__ import annotations

import csv
import hashlib
import html as html_lib
import json
import re
import subprocess
import sys
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import osmium

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalogue.non_driving_school import is_non_driving_school

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path("/tmp/osm-americas")
LIMIT = 250
UA = "Mozilla/5.0 (compatible; DriveLinkUpCatalogue/1.0; +https://www.drivelinkup.com)"
SEARCH_SLEEP = 12.0

ON_CSV = (
    "https://data.ontario.ca/dataset/b94f3a8a-7af1-4414-87fe-9e9c226e134a/"
    "resource/f0e8d85b-3711-45c3-a787-c2227eaf09e4/download/"
    "driving_school_website_october_21_2026_english.csv"
)
RJ_CFC = "https://www2.detran.rj.gov.br/portal/cfcs/cfcs"

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
    "yelp.",
    "tripadvisor.",
    "wikipedia.org",
    "wikidata.org",
    "openstreetmap.org",
    "linktr.ee",
    "wa.me",
    "yellowpages.",
    "canada411.",
    "yp.ca",
    "apple.com",
    "mapquest.com",
    "infobel.",
    "cylex",
    "chamberofcommerce.com",
    "drivingschools.directory",
    "drivami.com",
    "trubicars.",
    "drivingtests101.",
    "trueen.com",
    "getpassed.",
    "autoescolas.com.br",
    "autoserra.com.br",
    "wa.link",
    "saopaulofc.",
    "schema.org",
    "w3.org",
    "googletagmanager.com",
)

STOP = {
    "driving",
    "school",
    "schools",
    "academy",
    "driver",
    "drivers",
    "education",
    "training",
    "the",
    "and",
    "new",
    "best",
    "first",
    "of",
    "inc",
    "ltd",
    "ltda",
    "llc",
    "corp",
    "me",
    "auto",
    "escola",
    "autoescola",
    "cfc",
    "centro",
    "formacao",
    "canada",
    "ontario",
    "de",
    "da",
    "do",
    "das",
    "dos",
}

SKIP_NAME = re.compile(
    r"drivetest|serviceontario|batalh[aã]o|\bdetran\b|despachante|atletas|futebol",
    re.I,
)
NAME_BR = re.compile(r"auto[\s-]?escola|forma[cç][aã]o de condutores", re.I)
SOURCES = Path(__file__).resolve().parent / "sources"


def slug(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-") or "school"


def fold(value: str) -> str:
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()


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
    if host.endswith((".gc.ca", ".gov.br", ".gov.on.ca")):
        return None
    return parsed.geturl().split("#")[0]


def norm_name(name: str, city: str = "") -> str:
    text = fold(name)
    text = re.sub(r"\b(inc|incorporated|ltd|limited|ltda|llc|corp|eireli)\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    city_fold = re.sub(r"[^a-z0-9]+", " ", fold(city)).strip()
    if city_fold and text.endswith(" " + city_fold):
        text = text[: -(len(city_fold) + 1)].strip()
    return text


def name_tokens(name: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", fold(name)) if t not in STOP and len(t) > 3][:3]


def curl_get(url: str, dest: Path) -> bool:
    CACHE.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 200:
        return True
    result = subprocess.run(
        ["curl", "-fsSL", "--max-time", "8", "-A", UA, "-o", str(dest), url],
        check=False,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0 or not dest.exists() or dest.stat().st_size < 50:
        dest.unlink(missing_ok=True)
        return False
    return True


SEARCH_BACKOFF = 0.0


def search_urls(query: str) -> list[str]:
    global SEARCH_BACKOFF
    dest = CACHE / f"brave-{slug(query)[:70]}.html"
    if dest.exists() and dest.stat().st_size < 2000:
        dest.unlink(missing_ok=True)
    if not dest.exists():
        if SEARCH_BACKOFF > time.time():
            wait = SEARCH_BACKOFF - time.time()
            print(f"search backoff {wait:.0f}s", flush=True)
            time.sleep(wait)
        ok = False
        for attempt in range(4):
            ok = curl_get("https://search.brave.com/search?q=" + quote_plus(query), dest)
            if ok:
                break
            SEARCH_BACKOFF = time.time() + 90
            print(f"search 429, sleeping 90s (attempt {attempt + 1})", flush=True)
            time.sleep(90)
        time.sleep(SEARCH_SLEEP)
        if not ok:
            return []
    text = dest.read_text(errors="replace")
    return [
        match.group(1)
        for match in re.finditer(
            r'class="result-content[^"]*"[\s\S]{0,500}?href="(https?://[^"]+)"',
            text,
        )
    ]


def page_has_name(url: str, name: str, country: str) -> bool:
    dest = CACHE / f"site-{slug(host_of(url))[:40]}-{slug(name)[:40]}.html"
    if not dest.exists() or dest.stat().st_size < 100:
        dest.unlink(missing_ok=True)
        if not curl_get(url, dest):
            return False
    raw = dest.read_text(errors="replace")
    text = fold(re.sub(r"<[^>]+>", " ", html_lib.unescape(raw)))
    if country == "CA":
        if "driving school" not in text and "driver education" not in text and "ecole de conduite" not in text:
            return False
    elif (
        "autoescola" not in text
        and "auto escola" not in text
        and " cfc " not in f" {text} "
        and "condutores" not in text
    ):
        return False
    tokens = name_tokens(name)
    if len(tokens) >= 2:
        return all(token in text for token in tokens)
    if len(tokens) == 1 and len(tokens[0]) >= 5:
        return tokens[0] in text
    return fold(name) in text


def candidate_urls(name: str, country: str) -> list[str]:
    urls: list[str] = []
    compact = re.sub(r"[^a-z0-9.]+", "", fold(name))
    embedded = re.search(r"([a-z0-9-]+\.(?:ca|com|com\.br|net|org))", compact)
    if embedded:
        urls.append("https://" + embedded.group(1))
    slim = slug(re.sub(r"\b(inc|ltd|limited|ltda)\b", "", name, flags=re.I))
    slim = re.sub(r"-inc$", "", slim)
    short = slim.replace("-driving-school", "").replace("-driving-academy", "")
    short = short.replace("-auto-escola", "").replace("-autoescola", "")
    tokens = [
        part
        for part in slim.split("-")
        if part not in {"driving", "school", "academy", "drivers", "the", "of", "auto", "escola"}
    ]
    joined = "".join(tokens)
    hosts = [slim, short, slim.replace("-", ""), short.replace("-", ""), joined]
    if joined:
        hosts.extend(
            [
                joined + "driving",
                joined + "drivingschool",
                joined + "autoescola",
                "autoescola" + joined,
                "cfc" + joined,
            ]
        )
    if country == "BR":
        if len(joined) >= 5:
            for host in (
                f"autoescola{joined}.com.br",
                f"{joined}autoescola.com.br",
                f"cfc{joined}.com.br",
            ):
                urls.append(f"https://{host}")
                urls.append(f"https://www.{host}")
        seen: set[str] = set()
        unique: list[str] = []
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            unique.append(url)
        return unique[:6]
    tlds = [".ca", ".com"]
    for host in hosts:
        if len(host) < 6:
            continue
        for tld in tlds:
            urls.append(f"https://{host}{tld}")
            urls.append(f"https://www.{host}{tld}")
    seen: set[str] = set()
    unique: list[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        unique.append(url)
    return unique[:16]


def discover_website(name: str, city: str, country: str) -> str | None:
    trimmed = re.sub(r"\([^)]*\)", " ", name)
    if city and fold(trimmed).endswith(fold(city)):
        trimmed = trimmed[: -len(city)]
    trimmed = trimmed.strip(" -–,")
    for raw in candidate_urls(trimmed or name, country):
        website = clean_website(raw)
        if website and page_has_name(website, name, country):
            return website
    return None


def ontario_groups() -> dict[str, list[dict]]:
    dest = CACHE / "on-mto.csv"
    if not curl_get(ON_CSV, dest):
        raise SystemExit("Ontario open-data CSV download failed")
    text = re.sub(r"<[^>]+>", " ", dest.read_text(encoding="utf-8-sig", errors="replace"))
    text = html_lib.unescape(text)
    rows = list(csv.reader(re.sub(r"[ \t]+", " ", text).splitlines()))
    groups: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for row in rows[1:]:
        if len(row) < 2:
            continue
        city = row[0].strip()
        name = re.sub(r"\s+", " ", row[1]).strip(" ,")
        if not city or not name or SKIP_NAME.search(name):
            continue
        key = (norm_name(name, city), city.casefold())
        if not key[0] or key in seen:
            continue
        seen.add(key)
        groups[key[0]].append({"country": "CA", "region": "ontario", "name": name, "city": city})
    print(f"Ontario groups {len(groups)} locations {sum(len(v) for v in groups.values())}", flush=True)
    return groups


def br_display_name(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw).strip()
    match = re.search(r"(AUTO[\s-]?ESCOLA.+)$", text, re.I)
    if match and len(match.group(1)) >= 14:
        text = match.group(1)
    return re.sub(r"\s+", " ", text).title()


def push_group(
    groups: dict[str, list[dict]],
    seen: set[tuple[str, str]],
    name: str,
    city: str,
    region: str,
) -> None:
    if not name or not city or SKIP_NAME.search(name):
        return
    key = norm_name(name, city)
    pair = (key, city.casefold())
    if not key or pair in seen:
        return
    seen.add(pair)
    groups[key].append({"country": "BR", "region": region, "name": name, "city": city})


def rio_groups() -> dict[str, list[dict]]:
    path = SOURCES / "rj-cfc.md"
    if not path.exists():
        print("missing RJ CFC source", flush=True)
        return {}
    groups: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for line in path.read_text(errors="replace").splitlines():
        if "| ativo |" not in line.lower():
            continue
        parts = [part.strip() for part in line.strip().strip("|").split("|")]
        if len(parts) < 3:
            continue
        name = br_display_name(parts[0])
        city = parts[2].split("-")[0].strip().title()
        push_group(groups, seen, name, city, "rio-de-janeiro")
    print(f"Rio groups {len(groups)} locations {sum(len(v) for v in groups.values())}", flush=True)
    return groups


def sc_groups() -> dict[str, list[dict]]:
    path = SOURCES / "sc-cfc.txt"
    if not path.exists():
        return {}
    groups: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    text = path.read_text(errors="replace")
    for match in re.finditer(
        r"### (CFC [^\n]+)\n\n Credencial:[^\n]+\n\n Município: ([^\n]+)",
        text,
    ):
        name = re.sub(r"\s+", " ", match.group(1)).strip().title()
        city = match.group(2).strip().title()
        push_group(groups, seen, name, city, "santa-catarina")
    print(f"Santa Catarina groups {len(groups)} locations {sum(len(v) for v in groups.values())}", flush=True)
    return groups


def osm_rows(pbf: Path, country: str, region: str) -> list[dict]:
    if not pbf.exists() or pbf.stat().st_size < 50_000_000:
        return []
    print(f"OSM {pbf.name}", flush=True)
    processor = osmium.FileProcessor(str(pbf)).with_filter(
        osmium.filter.KeyFilter("website", "contact:website")
    )
    rows = []
    for obj in processor:
        tags = {tag.k: tag.v for tag in obj.tags}
        name = (tags.get("name") or tags.get("name:en") or tags.get("name:pt") or "").strip()
        website = clean_website(tags.get("website") or tags.get("contact:website"))
        city = (tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:municipality") or "").strip()
        if not name or not website or not city:
            continue
        amenity = tags.get("amenity") == "driving_school"
        if country == "CA" and not amenity and "driving" not in fold(name):
            continue
        if country == "BR" and not amenity and not NAME_BR.search(name):
            continue
        if is_non_driving_school(name, website):
            continue
        rows.append(
            {"country": country, "region": region, "name": name, "city": city, "website": website}
        )
    print(f"OSM {pbf.name} kept {len(rows)}", flush=True)
    return rows


def collect(groups: dict[str, list[dict]], country: str, osm: list[dict]) -> list[dict]:
    picked: list[dict] = []
    used_pair: set[tuple[str, str]] = set()
    website_for: dict[str, str] = {}

    def add(item: dict, website: str) -> None:
        if SKIP_NAME.search(item["name"]):
            return
        host = host_of(website)
        pair = (host, item["city"].casefold())
        if pair in used_pair or is_non_driving_school(item["name"], website):
            return
        used_pair.add(pair)
        picked.append({**item, "website": website, "heavy": []})
        print(f"{country} kept {len(picked)} {item['city']} {item['name'][:40]} {host}", flush=True)

    def website_for_key(key: str) -> str | None:
        if key in website_for:
            return website_for[key]
        for known, url in website_for.items():
            if min(len(key), len(known)) < 12:
                continue
            if key.startswith(known) or known.startswith(key):
                return url
        return None

    for row in osm:
        if SKIP_NAME.search(row["name"]):
            continue
        key = norm_name(row["name"], row["city"])
        if key:
            website_for.setdefault(key, row["website"])
        add(row, row["website"])
        if len(picked) >= LIMIT:
            return picked

    pending = [
        (key, locations)
        for key, locations in sorted(groups.items(), key=lambda item: len(item[1]), reverse=True)
        if website_for_key(key) is None
    ]
    for key, locations in sorted(groups.items(), key=lambda item: len(item[1]), reverse=True):
        website = website_for_key(key)
        if not website:
            continue
        for item in locations:
            add(item, website)
            if len(picked) >= LIMIT:
                return picked

    def job(entry: tuple[str, list[dict]]) -> tuple[str, str | None, list[dict]]:
        key, locations = entry
        sample = locations[0]
        return key, discover_website(sample["name"], sample["city"], country), locations

    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(job, entry) for entry in pending]
        for future in as_completed(futures):
            if len(picked) >= LIMIT:
                break
            key, website, locations = future.result()
            if not website:
                continue
            website_for[key] = website
            for item in locations:
                add(item, website)
                if len(picked) >= LIMIT:
                    break
    return picked


def write_file(path: Path, country: str, currency: str, prefix: str, note: str, rows: list[dict]) -> None:
    if country == "CA" and len(rows) < LIMIT:
        raise SystemExit(f"{country}: only {len(rows)} schools with a city and own website (need {LIMIT}).")
    if country == "BR" and not rows:
        raise SystemExit("BR: no schools with a city and own website.")
    schools = []
    counts: dict[str, int] = {}
    for row in rows[:LIMIT]:
        digest = hashlib.sha1(f"{row['website']}|{row['city']}".encode()).hexdigest()[:6]
        schools.append(
            {
                "id": f"{prefix}{digest}-{slug(row['name'])}"[:80],
                "country": country,
                "region": row["region"],
                "name": row["name"],
                "city": row["city"],
                "website": row["website"],
                "categories": ["B"],
                "heavy": row.get("heavy") or [],
                "email": None,
                "phone": None,
                "lessonPrice": None,
                "lessonMinutes": None,
                "currency": currency,
                "language": "pt" if country == "BR" else "en",
                "sourceUrl": row["website"],
                "checkedAt": "2026-11-07",
                "websiteStatus": "LISTED",
            }
        )
        counts[row["region"]] = counts.get(row["region"], 0) + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"meta": {"collectedAt": "2026-11-07", "note": note, "light": len(schools), "heavy": 0, "counts": counts}, "schools": schools}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", path, len(schools), counts, flush=True)


def brazil_groups() -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for group in (rio_groups(), sc_groups()):
        for key, locations in group.items():
            for item in locations:
                pair = (key, item["city"].casefold())
                if pair in seen:
                    continue
                seen.add(pair)
                merged[key].append(item)
    print(f"Brazil groups {len(merged)} locations {sum(len(v) for v in merged.values())}", flush=True)
    return merged


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    canada_path = ROOT / "data" / "canada-schools" / "schools.json"
    if canada_path.exists() and len(json.loads(canada_path.read_text()).get("schools") or []) >= LIMIT:
        print("Canada already collected", flush=True)
    else:
        canada_osm = []
        for slug_name, region in (("ontario", "ontario"), ("quebec", "quebec")):
            canada_osm.extend(osm_rows(CACHE / f"ca-{slug_name}.osm.pbf", "CA", region))
        canada = collect(ontario_groups(), "CA", canada_osm)
        write_file(
            canada_path,
            "CA",
            "CAD",
            "ca",
            "Canadian driving schools named on Ontario's open government-approved list. A website is stored only when it is the school's own site and that page contains the school name. The same school website may appear in more than one city when the official list names that school in those cities. Directory and social profiles are not stored as the school website. Category B is a car school. No lesson price is stored. Nothing here is a verified permit.",
            canada,
        )
    brazil_osm = osm_rows(CACHE / "br-sudeste.osm.pbf", "BR", "sao-paulo")
    brazil = collect(brazil_groups(), "BR", brazil_osm)
    write_file(
        ROOT / "data" / "brazil-schools" / "schools.json",
        "BR",
        "BRL",
        "br",
        "Brazilian driving schools named on public DETRAN CFC lists for Rio de Janeiro and Santa Catarina. A website is stored only when it is the school's own site and that page contains the school name. Directory and social profiles are not stored as the school website. Category B is a car school. No lesson price is stored. Nothing here is a verified permit.",
        brazil,
    )


if __name__ == "__main__":
    main()

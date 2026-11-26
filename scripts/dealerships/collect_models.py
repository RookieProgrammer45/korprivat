#!/usr/bin/env python3
"""Read car model and specs from a dealer's own published search.

The dealer page embeds the public query it uses to draw its car cards
(model, year, mileage, fuel, gearbox, price, photo). This script stores
that published card and skips registration numbers. It does not invent a
spec the page did not return.

  python3 scripts/dealerships/collect_models.py
"""

from __future__ import annotations

import base64
import json
import re
import ssl
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DEALER_PATH = ROOT / "data" / "dealerships" / "dealerships.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
PER_DEALER = 24

QUERY = """
query SiteSearch($market: [String], $branchGroupId: String!, $page: Int, $perPage: Int) {
  search {
    ads(
      market: $market
      branchGroupId: $branchGroupId
      page: $page
      perPage: $perPage
      soldWithinDays: 0
    ) {
      found
      hits {
        ad {
          id
          salesDescription { title }
          pricing { cash { price { amount } } }
          media(limit: 1) { items { ... on AdImage { formats { format url } } } }
          branch { displayName }
        }
        iteration {
          logistics { odometerReading { value unit } }
          item {
            ... on Vehicle {
              displayName
              manufacturer { stringValue }
              modelSeries { stringValue }
              modelYear { intValue }
              driveline { fuelTypesString { stringValue } }
              attributes { transmission { formattedValue } }
            }
          }
        }
      }
    }
  }
}
"""

LINK = re.compile(r'href="([^"]+)"', re.I)
INTEREST = re.compile(
    r"bilsok|begagn|bruktsalg|bruktbil|brukte|/sok(?:[/?\"']|$)|lager|fordon|kjøretøy|kjoretoy|bilar-till|bilannon|nye-biler|nya-bilar",
    re.I,
)
ANCHOR = re.compile(r"<a\b([^>]*)>(.*?)</a>", re.I | re.S)
HREF_ATTR = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG = re.compile(r"<[^>]+>")
CARD_YEAR = re.compile(r"\b(19[8-9]\d|20[0-3]\d)\b")
CARD_MILE = re.compile(r"(\d{1,3}(?:[ \u00a0.]\d{3})+|\d{1,7})\s*(km|mil)\b", re.I)
CARD_PRICE = re.compile(
    r"(?:kr|nok|sek|dkk)\.?\s*(\d{1,3}(?:[ \u00a0.]\d{3})+|\d{5,7})\b"
    r"|(\d{1,3}(?:[ \u00a0.]\d{3})+|\d{5,7})\s*(?:kr\b|:-)",
    re.I,
)
CARD_FUEL = re.compile(
    r"\b(bensin\s*\+\s*el|bensin|diesel|elektrisitet|elektrisk|laddhybrid|hybrid|plug-in|etanol|gass|el)\b",
    re.I,
)
CARD_GEAR = re.compile(r"\b(automatisk|automatgear|automat|manuell|manuel)\b", re.I)
CARD_POWER = re.compile(r"\b(\d{2,4})\s*(hk|hp|kw)\b", re.I)
CARD_TITLE = re.compile(r"<h[1-3][^>]*>(.*?)</h[1-3]>", re.I | re.S)
CARD_ALT = re.compile(r"""<img\b[^>]*\balt=["']([^"']+)["']""", re.I)
CARD_IMG = re.compile(r"""<img\b[^>]*\bsrc=["'](https?://[^"']+)["']""", re.I)
PLATE = re.compile(r"\b[A-Z]{3}\d{2}[A-Z0-9]\b|\b[A-Z]{3}\s\d{2}[A-Z]\b", re.I)
GENERIC_NAME = {
    "fordon",
    "kjøretøy",
    "kjoretoy",
    "bil",
    "bilar",
    "biler",
    "läs mer",
    "les mer",
    "se mer",
    "publicerat pris",
}
CURRENCY = {"SE": "SEK", "NO": "NOK", "DK": "DKK", "FI": "EUR", "IS": "ISK"}


def fetch(url: str, timeout: int = 12, data: bytes | None = None, headers: dict | None = None) -> tuple[str, bytes]:
    req = Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urlopen(req, timeout=timeout, context=CTX) as response:
        return response.geturl(), response.read()


def origin_of(url: str) -> str:
    parts = urlparse(url)
    if not parts.scheme or not parts.netloc:
        return ""
    return f"{parts.scheme}://{parts.netloc}"


def same_host(page: str, href: str) -> str | None:
    absolute = urljoin(page, href)
    if origin_of(absolute) != origin_of(page):
        return None
    if absolute.startswith(("mailto:", "tel:")):
        return None
    return absolute.split("#")[0]


def props_from(html: str) -> list[dict]:
    found: dict[tuple[str, str], dict] = {}
    order: list[tuple[str, str]] = []
    for raw in re.findall(r'data-props="([^"]+)"', html):
        try:
            data = json.loads(base64.b64decode(raw))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        api = data.get("publicApiUrl")
        branch = data.get("branchGroupId")
        if not isinstance(api, str) or not api.startswith("https://") or not isinstance(branch, str):
            continue
        key = (api, branch)
        current = found.get(key)
        if current is None:
            found[key] = data
            order.append(key)
            continue
        href = data.get("href")
        if not current.get("href") and isinstance(href, str) and href:
            current["href"] = href
    return [found[key] for key in order]


def image_from(formats: list) -> str | None:
    ranked = []
    for item in formats or []:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        name = str(item.get("format") or "")
        if isinstance(url, str) and url.startswith("https://"):
            ranked.append((0 if name == "380x253" else 1, url))
    ranked.sort()
    return ranked[0][1] if ranked else None


def mileage_from(reading: dict | None) -> tuple[int | None, str | None]:
    if not isinstance(reading, dict):
        return None, None
    value = reading.get("value")
    unit = reading.get("unit")
    if not isinstance(value, int) or value < 0:
        return None, None
    if unit == "SCANDINAVIAN_MILE":
        return value, "mil"
    if unit in ("KILOMETER", "Kilometer"):
        return value, "km"
    return None, None


def kind_for(name: str) -> str:
    lowered = name.lower()
    if re.search(r"\b(motorcykel|motorsykkel|motorcycle|mc)\b", lowered):
        return "motorcycle"
    if any(word in lowered for word in ("lastbil", "lastebil", "buss", "lastvogn")):
        return "heavy"
    if re.search(r"\b(van|skåpbil|transportbil|varebil)\b", lowered) or "transport" in lowered:
        return "van"
    return "car"


def car_from_hit(hit: dict, page: str, href: str, currency: str) -> dict | None:
    ad = hit.get("ad") or {}
    item = ((hit.get("iteration") or {}).get("item")) or {}
    if not isinstance(ad, dict) or not isinstance(item, dict):
        return None
    title = ((ad.get("salesDescription") or {}).get("title") or "").strip()
    model = (item.get("displayName") or "").strip()
    series = ((item.get("modelSeries") or {}).get("stringValue") or "").strip()
    manufacturer = ((item.get("manufacturer") or {}).get("stringValue") or "").strip()
    name = model or title
    published = title.casefold()
    if title and (
        (series and series.casefold() in published)
        or (manufacturer and manufacturer.casefold() in published and len(title) > len(model))
    ):
        name = title
    if len(name) < 2:
        return None
    amount = (((ad.get("pricing") or {}).get("cash") or {}).get("price") or {}).get("amount")
    try:
        price = int(float(amount))
    except (TypeError, ValueError):
        return None
    if price < 15_000 or price > 4_000_000:
        return None
    year = (item.get("modelYear") or {}).get("intValue")
    year = year if isinstance(year, int) and 1980 <= year <= 2035 else None
    mileage, mileage_unit = mileage_from(((hit.get("iteration") or {}).get("logistics") or {}).get("odometerReading"))
    fuel = (((item.get("driveline") or {}).get("fuelTypesString") or {}).get("stringValue") or "").strip() or None
    gearbox = ((((item.get("attributes") or {}).get("transmission") or {}).get("formattedValue")) or "").strip() or None
    if year is None and mileage is None and not fuel and not gearbox:
        return None
    ad_id = ad.get("id")
    source = page
    if isinstance(ad_id, str) and href:
        source = urljoin(page, href + ad_id)
    elif isinstance(ad_id, str):
        source = f"{page.split('#')[0]}#ad-{ad_id}"
    media = (((ad.get("media") or {}).get("items")) or [{}])[0] or {}
    return {
        "name": name[:120],
        "make": manufacturer[:40] or None,
        "model": (series or model)[:40] or None,
        "kind": kind_for(name),
        "price": price,
        "currency": currency,
        "sourceUrl": source,
        "year": year,
        "mileage": mileage,
        "mileageUnit": mileage_unit,
        "fuel": fuel[:40] if fuel else None,
        "gearbox": gearbox[:40] if gearbox else None,
        "imageUrl": image_from(media.get("formats") if isinstance(media, dict) else []),
    }


def cars_from_props(prop: dict, page: str, currency: str, market: str) -> list[dict]:
    body = json.dumps(
        {
            "query": QUERY,
            "variables": {
                "market": [prop.get("marketCode") or market],
                "branchGroupId": prop["branchGroupId"],
                "page": 1,
                "perPage": PER_DEALER,
            },
        }
    ).encode()
    _, raw = fetch(
        prop["publicApiUrl"],
        timeout=20,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": origin_of(page),
            "x-graphql-client-version": "website-components-react@1.0.0",
            "Origin": origin_of(page),
        },
    )
    payload = json.loads(raw)
    hits = (((payload.get("data") or {}).get("search") or {}).get("ads") or {}).get("hits") or []
    href = prop.get("href") if isinstance(prop.get("href"), str) else ""
    cars = []
    seen = set()
    for hit in hits:
        car = car_from_hit(hit, page, href, currency)
        if not car or car["sourceUrl"] in seen:
            continue
        seen.add(car["sourceUrl"])
        cars.append(car)
        if len(cars) >= PER_DEALER:
            break
    return cars


def money_from(raw: str) -> int | None:
    digits = raw.replace(" ", "").replace("\u00a0", "").replace(".", "")
    if not digits.isdigit():
        return None
    amount = int(digits)
    if amount < 15_000 or amount > 4_000_000:
        return None
    return amount


def condition_from(href: str) -> str | None:
    path = href.lower()
    if re.search(r"brukt|begagn", path):
        return "used"
    if re.search(r"nya-bilar|nye-biler|nybil|ny-bil", path):
        return "new"
    return None


def html_cars(html: str, page: str, currency: str) -> list[dict]:
    """Read a car card only when the dealer's page prints the price and a spec."""
    cars = []
    seen = set()
    for attrs, inner in ANCHOR.findall(html):
        href_match = HREF_ATTR.search(attrs)
        if not href_match:
            continue
        source = same_host(page, unescape(href_match.group(1)))
        if not source or source in seen:
            continue
        if len(inner) > 2500:
            continue
        text = " ".join(TAG.sub(" ", unescape(inner)).split())
        if len(text) < 8:
            continue
        price_match = CARD_PRICE.search(text)
        if not price_match:
            continue
        price = money_from(next(group for group in price_match.groups() if group))
        if price is None:
            continue
        year_match = CARD_YEAR.search(text)
        year = int(year_match.group(1)) if year_match else None
        mileage = None
        mileage_unit = None
        for mile_match in CARD_MILE.finditer(text):
            around = text[max(0, mile_match.start() - 24) : mile_match.end() + 24].lower()
            if re.search(r"räckvidd|raeckvidd|rekkevidde|wltp|räckvidde", around):
                continue
            candidate = money_from_count(mile_match.group(1))
            unit = mile_match.group(2).lower()
            if candidate is None or unit not in ("km", "mil"):
                continue
            if year is not None and candidate == year:
                continue
            mileage = candidate
            mileage_unit = unit
            break
        fuel_match = CARD_FUEL.search(text)
        fuel = " ".join(fuel_match.group(1).split()) if fuel_match else None
        gear_match = CARD_GEAR.search(text)
        gearbox = gear_match.group(1) if gear_match else None
        if year is None and mileage is None and not fuel and not gearbox:
            continue
        title_match = CARD_TITLE.search(inner)
        alt_match = CARD_ALT.search(inner)
        name = " ".join(TAG.sub(" ", unescape((title_match or alt_match).group(1))).split()) if (title_match or alt_match) else text
        name = PLATE.sub("", name)
        name = re.sub(r"^(\S+)(?:\s+\1\b)+", r"\1", name, flags=re.I)
        name = " ".join(name.split())[:120]
        if len(name) < 3 or name.casefold() in GENERIC_NAME:
            continue
        if re.search(r"/kampanj", source, re.I):
            continue
        if re.search(r"\b(från|fra|pris fr)\b|kr rabatt", name, re.I):
            continue
        if year is None:
            named_year = CARD_YEAR.search(name)
            year = int(named_year.group(1)) if named_year else None
        if year is None and mileage is None:
            continue
        power_match = CARD_POWER.search(text)
        image_match = CARD_IMG.search(inner)
        image = unescape(image_match.group(1)) if image_match else None
        if image and not image.startswith("https://"):
            image = None
        seen.add(source)
        cars.append(
            {
                "name": name,
                "make": None,
                "model": None,
                "kind": kind_for(f"{name} {source}"),
                "condition": condition_from(source),
                "price": price,
                "currency": currency,
                "sourceUrl": source,
                "year": year,
                "mileage": mileage,
                "mileageUnit": mileage_unit,
                "fuel": fuel[:40] if fuel else None,
                "gearbox": gearbox[:40] if gearbox else None,
                "power": f"{power_match.group(1)} {power_match.group(2)}" if power_match else None,
                "imageUrl": image,
            }
        )
        if len(cars) >= PER_DEALER:
            break
    return cars


def money_from_count(raw: str) -> int | None:
    digits = raw.replace(" ", "").replace("\u00a0", "").replace(".", "")
    if not digits.isdigit():
        return None
    value = int(digits)
    if value < 0 or value >= 2_000_000:
        return None
    return value


def candidate_pages(website: str) -> list[str]:
    pages = [website]
    try:
        final, html_bytes = fetch(website)
        html = html_bytes.decode("utf-8", "replace")
        pages = [final]
    except Exception:
        return pages
    host_links = []
    for href in LINK.findall(html):
        if not INTEREST.search(href):
            continue
        absolute = same_host(website, href)
        if absolute and absolute not in host_links and absolute.rstrip("/") != website.rstrip("/"):
            host_links.append(absolute)
        if len(host_links) >= 5:
            break
    return pages + host_links


def cars_for(dealer: dict) -> list[dict]:
    website = dealer.get("website")
    if not isinstance(website, str):
        return []
    country = dealer.get("country") if isinstance(dealer.get("country"), str) else "SE"
    currency = CURRENCY.get(country, "SEK")
    market = country if country in CURRENCY else "SE"
    best: list[dict] = []
    printed: list[dict] = []
    for page in candidate_pages(website):
        try:
            final, html_bytes = fetch(page)
            html = html_bytes.decode("utf-8", "replace")
            page = final
        except Exception:
            continue
        found = []
        for prop in props_from(html):
            try:
                found.extend(cars_from_props(prop, page, currency, market))
            except Exception:
                continue
        if len(found) > len(best):
            best = found
        cards = html_cars(html, page, currency)
        if len(cards) > len(printed):
            printed = cards
    if best:
        return best[:PER_DEALER]
    return printed[:PER_DEALER]


FUEL_CANON = {
    "el": "El",
    "elektrisk": "Elektrisk",
    "elektrisitet": "Elektrisitet",
    "bensin": "Bensin",
    "diesel": "Diesel",
    "hybrid": "Hybrid",
    "laddhybrid": "Laddhybrid",
    "plugin": "Plug-in",
    "plug-in": "Plug-in",
    "bensin+el": "Bensin+El",
}
SPEC_TAIL = re.compile(
    r"\s+(?:Årsmodell|Mil|Färg|Farge|Kaross|Finns i|Växellåda)\b.*$",
    re.I,
)
COLOR_IN_NAME = re.compile(r"(?:Färg|Farge)\s*:\s*([^,|]{2,24})", re.I)


def canon_fuel(fuel: str) -> str:
    compact = re.sub(r"\s+", "", fuel).casefold()
    return FUEL_CANON.get(compact, " ".join(fuel.split())[:40])


def polish_vehicle(vehicle: dict) -> dict:
    name = vehicle.get("name") if isinstance(vehicle.get("name"), str) else ""
    color_match = COLOR_IN_NAME.search(name)
    color = vehicle.get("color")
    if not color and color_match:
        color = " ".join(color_match.group(1).split())[:40]
    trimmed = SPEC_TAIL.sub("", name)
    trimmed = re.sub(r"\s+", " ", trimmed).strip(" -|,")
    if len(trimmed) >= 2:
        name = trimmed[:120]
    fuel = vehicle.get("fuel")
    if isinstance(fuel, str) and fuel.strip():
        fuel = canon_fuel(fuel)
    gearbox = vehicle.get("gearbox")
    if isinstance(gearbox, str):
        gear_key = gearbox.casefold()
        gearbox = {"automat": "Automat", "automatisk": "Automatisk", "manuell": "Manuell", "manuel": "Manuel"}.get(
            gear_key, gearbox.strip()[:40]
        )
    kind = vehicle.get("kind")
    if re.search(r"\b(husvagn|husbil|bobil|camper)\b", name, re.I):
        kind = "other"
    elif re.search(r"\b(lastbil|lastebil|lastvogn)\b", name, re.I):
        kind = "heavy"
    return {**vehicle, "name": name, "fuel": fuel, "gearbox": gearbox, "color": color, "kind": kind}


def published(vehicle: dict) -> bool:
    return bool(vehicle.get("year") or vehicle.get("mileage") or vehicle.get("fuel") or vehicle.get("gearbox"))


def cleaned(vehicle: dict) -> dict | None:
    """Drop a printed card that is a starting price or a discount, not a vehicle."""
    if vehicle.get("make"):
        return vehicle
    name = vehicle.get("name") if isinstance(vehicle.get("name"), str) else ""
    source = vehicle.get("sourceUrl") if isinstance(vehicle.get("sourceUrl"), str) else ""
    name = re.sub(r"^(\S+)(?:\s+\1\b)+", r"\1", name, flags=re.I)
    name = " ".join(name.split())
    if re.search(r"/kampanj", source, re.I):
        return None
    if re.search(r"\b(från|fra|pris fr)\b|kr rabatt", name, re.I):
        return None
    if vehicle.get("year") is None:
        named_year = CARD_YEAR.search(name)
        if named_year:
            vehicle = {**vehicle, "year": int(named_year.group(1))}
    if vehicle.get("year") is None and vehicle.get("mileage") is None:
        return None
    kind = kind_for(f"{name} {source}")
    return {**vehicle, "name": name[:120], "kind": kind}


def prune(dealers: list[dict]) -> None:
    seen: set[str] = set()
    for dealer in dealers:
        vehicles = dealer.get("vehicles")
        if not isinstance(vehicles, list):
            continue
        kept = []
        for vehicle in vehicles:
            if not isinstance(vehicle, dict):
                continue
            if published(vehicle):
                vehicle = cleaned(vehicle)
                if not vehicle:
                    continue
                vehicle = polish_vehicle(vehicle)
            else:
                continue
                source = vehicle.get("sourceUrl")
                if isinstance(source, str) and source in seen:
                    continue
                if isinstance(source, str):
                    seen.add(source)
            kept.append(vehicle)
        dealer["vehicles"] = kept


def main() -> None:
    data = json.loads(DEALER_PATH.read_text())
    dealers = data["dealers"]
    updated = 0
    car_count = 0

    def job(index: int) -> tuple[int, list[dict]]:
        return index, cars_for(dealers[index])

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(job, index) for index, dealer in enumerate(dealers) if dealer.get("website")]
        for future in as_completed(futures):
            index, cars = future.result()
            if not cars:
                continue
            dealers[index]["vehicles"] = cars
            updated += 1
            car_count += len(cars)
            print(updated, dealers[index]["name"], len(cars), flush=True)

    prune(dealers)
    DEALER_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("dealers with model cards", updated, "cars", car_count)


if __name__ == "__main__":
    main()

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
INTEREST = re.compile(r"bilsok|begagn|/sok(?:[/?\"']|$)|lager|fordon|brukte|kjoretoy|kjøretøy", re.I)


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
    found = []
    seen = set()
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
        if key in seen:
            continue
        seen.add(key)
        found.append(data)
    return found


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
    if any(word in lowered for word in ("lastbil", "lastebil", "buss")):
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
    media = (((ad.get("media") or {}).get("items")) or [{}])[0] or {}
    return {
        "name": name[:120],
        "kind": kind_for(name),
        "price": price,
        "currency": currency,
        "sourceUrl": source,
        "year": year,
        "mileage": mileage,
        "mileageUnit": mileage_unit,
        "fuel": fuel,
        "gearbox": gearbox,
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


def candidate_pages(website: str) -> list[str]:
    pages = [website]
    try:
        final, html_bytes = fetch(website)
        html = html_bytes.decode("utf-8", "replace")
        pages = [final]
    except Exception:
        return pages
    if props_from(html):
        return pages
    host_links = []
    for href in LINK.findall(html):
        if not INTEREST.search(href):
            continue
        absolute = same_host(website, href)
        if absolute and absolute not in host_links and absolute.rstrip("/") != website.rstrip("/"):
            host_links.append(absolute)
        if len(host_links) >= 3:
            break
    return pages + host_links


def cars_for(dealer: dict) -> list[dict]:
    website = dealer.get("website")
    if not isinstance(website, str):
        return []
    currency = "NOK" if dealer.get("country") == "NO" else "SEK"
    market = "NO" if dealer.get("country") == "NO" else "SE"
    for page in candidate_pages(website):
        try:
            final, html_bytes = fetch(page)
            html = html_bytes.decode("utf-8", "replace")
            page = final
        except Exception:
            continue
        for prop in props_from(html):
            try:
                cars = cars_from_props(prop, page, currency, market)
            except Exception:
                continue
            if cars:
                return cars
    return []


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

    DEALER_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("dealers with model cards", updated, "cars", car_count)


if __name__ == "__main__":
    main()

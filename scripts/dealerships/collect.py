#!/usr/bin/env python3
"""Collect Nordic dealerships and business logos.

Identity comes from a public member list that already links to the business
website (MRF in Sweden, NBF in Norway). Prices, phone, email and the logo are
kept only when that website shows them. Nothing here is a verified claim or a
purchase amount.

  python3 scripts/dealerships/collect.py
"""

from __future__ import annotations

import json
import re
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DEALER_PATH = ROOT / "data" / "dealerships" / "dealerships.json"
LOGO_PATH = ROOT / "data" / "business-logos" / "logos.json"
TODAY = time.strftime("%Y-%m-%d")
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()

PRICE = re.compile(
    r"(?<!\d)(\d{1,3}(?:[ \u00a0.]\d{3})+|\d{5,7})\s*(?:kr|:-|SEK|NOK|DKK|€|EUR)\b",
    re.I,
)
EMAIL = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
PHONE = re.compile(r"(?:\+\d{1,3}[\s\-]?)?(?:\d[\s\-]?){8,14}")


def fetch(url: str, timeout: int = 12, data: bytes | None = None) -> str:
    req = Request(
        url,
        data=data,
        headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"},
    )
    with urlopen(req, timeout=timeout, context=CTX) as response:
        raw = response.read(1_500_000)
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, "replace")


def abs_url(base: str, href: str | None) -> str | None:
    if not href:
        return None
    href = href.strip()
    if href.startswith("data:") or href.startswith("javascript:"):
        return None
    joined = urljoin(base, href)
    parsed = urlparse(joined)
    if parsed.scheme not in ("http", "https"):
        return None
    return joined


class PageBits(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.icons: list[tuple[int, str]] = []
        self.og: str | None = None
        self.skip = 0
        self.chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag == "link":
            rel = data.get("rel", "").lower()
            href = data.get("href")
            if href and "apple-touch-icon" in rel:
                self.icons.append((0, href))
            elif href and "icon" in rel:
                self.icons.append((1, href))
        if tag == "meta" and data.get("property", "").lower() == "og:image" and data.get("content"):
            self.og = data["content"]
        if tag == "img":
            blob = " ".join(
                [data.get("src", ""), data.get("alt", ""), data.get("class", ""), data.get("id", "")]
            ).lower()
            if data.get("src") and any(word in blob for word in ("logo", "logotyp", "logga", "brand")):
                self.icons.append((0, data["src"]))

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if self.skip == 0 and data.strip():
            self.chunks.append(data)


def kind_for(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ("lastbil", "lastebil", "kuorma", "buss", "truck")):
        return "heavy"
    if any(word in lowered for word in ("husbil", "bobil", "camper", "matkailu", "släp", "slap")):
        return "other"
    if any(word in lowered for word in ("transport", "varebil", "skåp", "skap", "van ")):
        return "van"
    return "car"


def vehicles_from(text: str, page_url: str, currency: str) -> list[dict]:
    found: list[dict] = []
    seen: set[int] = set()
    for match in PRICE.finditer(text):
        raw = match.group(1).replace(" ", "").replace("\u00a0", "").replace(".", "")
        try:
            amount = int(raw)
        except ValueError:
            continue
        if amount < 15_000 or amount > 4_000_000 or amount in seen:
            continue
        seen.add(amount)
        name = " ".join(text[max(0, match.start() - 70) : match.start()].split())
        name = re.sub(r"[^0-9A-Za-zÅÄÖåäöÆØæøÉéÜü \-]", " ", name)
        name = " ".join(name.split())[-80:].strip(" -")
        if len(name) < 3:
            name = "Fordon" if currency == "SEK" else "Kjøretøy"
        found.append(
            {
                "name": name,
                "kind": kind_for(name),
                "price": amount,
                "currency": currency,
                "sourceUrl": page_url,
            }
        )
        if len(found) >= 8:
            break
    return found


def contact_from(text: str) -> tuple[str | None, str | None]:
    email = None
    for match in EMAIL.finditer(text):
        candidate = match.group(0).lower()
        if any(bad in candidate for bad in ("example.", "sentry", "wixpress", ".png", ".jpg")):
            continue
        email = candidate
        break
    phone = None
    for match in PHONE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if 8 <= len(digits) <= 15:
            phone = " ".join(match.group(0).split())
            break
    return phone, email


def read_site(url: str, currency: str) -> dict:
    try:
        html = fetch(url, timeout=10)
    except Exception:
        return {"logoUrl": None, "phone": None, "email": None, "vehicles": []}
    parser = PageBits()
    try:
        parser.feed(html)
    except Exception:
        pass
    logo = None
    for _, href in sorted(parser.icons, key=lambda item: item[0]):
        logo = abs_url(url, href)
        if logo:
            break
    if not logo:
        logo = abs_url(url, parser.og)
    text = " ".join(parser.chunks)
    phone, email = contact_from(text)
    return {
        "logoUrl": logo,
        "phone": phone,
        "email": email,
        "vehicles": vehicles_from(text, url, currency),
    }


def mrf_rows(category: str) -> list[dict]:
    url = (
        "https://www.mrf.se/ajax/search_crm.php?map_filter_type="
        f"{quote(category)}&map_filter_brand=0"
    )
    html = fetch(url, timeout=40, data=b"map_id=9&map_search_q=")
    rows = []
    for row in re.finditer(r"<tr\b([^>]*)>(.*?)</tr>", html, re.S):
        attrs, body = row.group(1), row.group(2)
        title = attr(attrs, "data-itemtitle")
        link = attr(attrs, "data-link")
        address = attr(attrs, "data-address")
        if not title:
            continue
        brands = re.findall(r"<li>([^<]+)</li>", body)
        city = ""
        postal = re.search(r"(\d{3}\s?\d{2})\s+([^,]+)$", address or "")
        if postal:
            city = postal.group(2).strip()
        rows.append(
            {
                "country": "SE",
                "name": title.strip(),
                "city": city,
                "address": address or "",
                "website": link or None,
                "brands": brands,
                "categories": [category],
                "sourceUrl": "https://www.mrf.se/medlem/sok-medlem/",
                "sourceName": "MRF",
                "currency": "SEK",
            }
        )
    return rows


def attr(blob: str, name: str) -> str:
    match = re.search(rf'{name}="([^"]*)"', blob)
    return match.group(1).strip() if match else ""


def nbf_rows() -> list[dict]:
    html = fetch("https://www.nbf.no/om-oss/vare-medlemmer/", timeout=40)
    rows = []
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        if "ItemList" not in block:
            continue
        data = json.loads(block)
        for item in data.get("mainEntity", {}).get("itemListElement", []):
            org = item.get("item") or {}
            description = org.get("description") or ""
            if "Bilforhandler" not in description:
                continue
            place = description.split(",")[-1].strip()
            rows.append(
                {
                    "country": "NO",
                    "name": org.get("name") or item.get("name"),
                    "city": place,
                    "address": description,
                    "website": org.get("url"),
                    "brands": [],
                    "categories": ["Bilforhandler"],
                    "sourceUrl": "https://www.nbf.no/om-oss/vare-medlemmer/",
                    "sourceName": "NBF",
                    "currency": "NOK",
                }
            )
    return rows


def slug(country: str, name: str, website: str | None) -> str:
    host = urlparse(website or "").netloc
    if host.startswith("www."):
        host = host[4:]
    base = host or name
    base = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    return f"{country.lower()}-{base}"[:80]


def school_targets() -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = []
    prices = json.loads((ROOT / "data/school-prices/school-prices.json").read_text())
    for school in prices["schools"]:
        website = school.get("website")
        if not website:
            continue
        keys = [school["id"], *school.get("listingIds", [])]
        for key in keys:
            targets.append((key, website))
    nordic = json.loads((ROOT / "data/nordic-schools/schools.json").read_text())
    for school in nordic["schools"]:
        if school.get("website"):
            targets.append((school["id"], school["website"]))
    return targets


def main() -> None:
    dealers = mrf_rows("Bilhandel") + mrf_rows("Tunga fordon")
    try:
        dealers.extend(nbf_rows())
    except Exception as error:
        print("nbf skipped", error)
    unique: dict[str, dict] = {}
    for dealer in dealers:
        key = (dealer["website"] or dealer["name"]).lower()
        current = unique.get(key)
        if current:
            current["categories"] = sorted(set(current["categories"] + dealer["categories"]))
            current["brands"] = sorted(set(current["brands"] + dealer["brands"]))
            continue
        unique[key] = dealer
    pending = list(unique.values())
    print(f"dealers {len(pending)}")

    def enrich(dealer: dict) -> dict:
        site = read_site(dealer["website"], dealer["currency"]) if dealer.get("website") else {
            "logoUrl": None,
            "phone": None,
            "email": None,
            "vehicles": [],
        }
        dealer.update(site)
        dealer["id"] = slug(dealer["country"], dealer["name"], dealer.get("website"))
        dealer["checkedAt"] = TODAY
        dealer.pop("currency", None)
        return dealer

    done: list[dict] = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(enrich, dealer) for dealer in pending]
        for index, future in enumerate(as_completed(futures), start=1):
            done.append(future.result())
            if index % 100 == 0:
                print(f"dealers fetched {index}/{len(pending)}", flush=True)

    done.sort(key=lambda row: (row["country"], row["city"], row["name"]))
    DEALER_PATH.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": TODAY,
                    "note": "Dealer identity comes from a public member list that links to the dealer's website. Prices, logos and contact details are kept only when that website shows them. Advertised, not verified, and not a purchase amount.",
                },
                "dealers": done,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print("wrote", DEALER_PATH, "dealers", len(done), "with prices", sum(1 for row in done if row["vehicles"]))

    logos: dict[str, str] = {}
    pairs = school_targets()
    websites = list({website for _, website in pairs})
    print(f"school sites {len(websites)}")

    def school_logo(website: str) -> tuple[str, str | None]:
        return website, read_site(website, "SEK").get("logoUrl")

    found: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(school_logo, website) for website in websites]
        for index, future in enumerate(as_completed(futures), start=1):
            website, logo = future.result()
            if logo:
                found[website] = logo
            if index % 100 == 0:
                print(f"school logos {index}/{len(websites)}", flush=True)
    for key, website in pairs:
        if website in found:
            logos[key] = found[website]
    LOGO_PATH.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": TODAY,
                    "note": "Logo URLs read from each business's own website. Identification only.",
                },
                "byKey": logos,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print("wrote", LOGO_PATH, "keys", len(logos))


if __name__ == "__main__":
    main()

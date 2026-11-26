#!/usr/bin/env python3
"""Read spare parts, motorcycle gear and accessories from shops that publish them.

Motonet prints the product card in its search page: name, price, brand,
category and the specification lines in the description. Customhoj is a
Shopify store, so its public catalogue is /products.json. A row is stored
only when that page publishes a price and at least one specification.
Nothing is invented, and a price stays in the currency the shop printed.

  python3 scripts/parts/collect_motonet.py
"""

from __future__ import annotations

import json
import re
import ssl
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "parts" / "products.json"
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
CHECKED = "2026-11-26"
BULLET = re.compile(r"^[\s]*[•·]\s*(.+)$")
TAG = re.compile(r"<[^>]+>")
LI = re.compile(r"<li[^>]*>(.*?)</li>", re.I | re.S)
FROM_PRICE = re.compile(r"\bfrån\b|\bfra\b|\balkaen\b", re.I)

SE_QUERIES = [
    "mc hjälm",
    "mc handske",
    "motorcykel",
    "bromsbelägg",
    "bromsskiva",
    "motorolja",
    "bilbatteri",
    "torkarblad",
    "oljefilter",
    "luftfilter",
    "tändstift",
    "glödstift",
    "kylarvätska",
    "spolarvätska",
    "glödlampa",
    "golvmattor",
    "barnstol",
    "varningstriangel",
    "startkablar",
    "bogserlina",
    "stötdämpare",
    "koppling",
]
FI_QUERIES = [
    "kypärä",
    "ajohanska",
    "moottoripyörä",
    "jarrupalat",
    "jarrulevy",
    "moottoriöljy",
    "akku",
    "pyyhkijä",
    "öljynsuodatin",
    "ilmansuodatin",
    "sytytystulppa",
    "hehkutulppa",
    "jäähdytysneste",
    "lasinpesuneste",
    "polttimo",
    "kumimatot",
    "turvaistuin",
    "varoituskolmio",
    "käynnistyskaapelit",
    "hinausköysi",
    "iskunvaimennin",
    "kytkin",
]
PER_QUERY = 16
CUSTOMHOJ_CAP = 24


def fetch(url: str, accept: str) -> str:
    request = Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urlopen(request, timeout=25, context=CTX) as response:
        return response.read().decode("utf-8", "replace")


def money_from(raw: str) -> int | float | None:
    """The amount the shop printed. '99,90' stays 99.9 and '2 199 kr' stays 2199."""
    if not isinstance(raw, str) or FROM_PRICE.search(raw):
        return None
    cleaned = re.sub(r"[^\d,.\s]", "", raw.replace("\xa0", " ")).strip()
    cleaned = re.sub(r"\s+", "", cleaned)
    if not cleaned or not re.search(r"\d", cleaned):
        return None
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        whole, fraction = cleaned.split(",", 1)
        cleaned = f"{whole.replace('.', '')}.{fraction}" if len(fraction) == 2 else cleaned.replace(",", "")
    elif cleaned.count(".") > 1 or (cleaned.count(".") == 1 and not re.search(r"\.\d{2}$", cleaned)):
        cleaned = cleaned.replace(".", "")
    try:
        amount = round(float(cleaned), 2)
    except ValueError:
        return None
    if amount < 1 or amount > 500_000:
        return None
    return int(amount) if amount == int(amount) else amount


def plain(value: str) -> str:
    return " ".join(TAG.sub(" ", value).replace("\xa0", " ").split())


def bullet_specs(description: str) -> list[str]:
    found = []
    for line in description.splitlines():
        match = BULLET.match(line.strip())
        if not match:
            continue
        text = " ".join(match.group(1).split())
        if len(text) < 3:
            continue
        found.append(text[:160])
        if len(found) >= 16:
            break
    return found


def list_specs(html: str) -> list[str]:
    found = []
    for item in LI.findall(html):
        text = plain(item)
        if len(text) < 3:
            continue
        found.append(text[:160])
        if len(found) >= 16:
            break
    return found


def contains(blob: str, word: str) -> bool:
    return word in blob


def has_word(blob: str, word: str) -> bool:
    return re.search(rf"(?<![a-zåäö]){re.escape(word)}(?![a-zåäö])", blob) is not None


OWNER_BITS = (
    "matta",
    "golv",
    "kumimatto",
    "barnstol",
    "turvaistuin",
    "child",
    "seat cover",
    "sätes",
    "penkinpääll",
    "varning",
    "varoitus",
    "triangle",
    "startkabel",
    "käynnistys",
    "bogser",
    "hinaus",
    "tow",
    "floor mat",
    "dash cam",
    "air fresh",
    "doft",
    "raikast",
    "laddare",
    "laturi",
    "wiper",
    "torkar",
    "pyyhin",
    "pyyhk",
    "glödlampa",
    "polttimo",
    "recovery",
    "mirror",
    "peili",
    "backspegel",
)
WORKSHOP_BITS = (
    "coil",
    "sytytyspuola",
    "rotor",
    "hand tool",
    "socket",
    "spanner",
    "screwdriver",
    "verktyg",
    "työkalu",
    "ball joint",
    "tie rod",
    "thermostat",
    "termostaatti",
    "engine mount",
    "fuel pump",
    "polttoaine",
    "ignition",
)
BOTH_BITS = (
    "olja",
    "öljy",
    "oil",
    "batteri",
    "akku",
    "battery",
    "spolar",
    "lasinpesu",
    "kylar",
    "jäähdyt",
    "coolant",
    "däck",
    "rengas",
    "tyre",
    "tire",
    "lampa",
    "bulb",
    "broms",
    "jarru",
    "brake",
    "tändstift",
    "sytytys",
    "spark",
    "filter",
    "suodatin",
    "glödstift",
    "hehkutulp",
    "glow plug",
    "koppling",
    "kytkin",
    "clutch",
    "stötdämp",
    "iskunvaim",
    "shock",
    "strut",
    "skiva",
    "levy",
)


HOUSEHOLD = re.compile(
    r"klotlamp|frostlamp|kronljus|bastulamp|sähköasenn|cykelvagn|cykelbarn",
    re.I,
)
CARB_JET = re.compile(r"\b(main jet|huvudmunstycke|förgasare)\b", re.I)


def relevant(row: dict) -> bool:
    blob = f"{row.get('category') or ''} {row['name']}"
    published = f"{blob} {' '.join(row.get('specs') or [])}"
    if HOUSEHOLD.search(blob):
        return False
    if re.search(r"cykel", blob, re.I) and not re.search(r"motorcykel", blob, re.I):
        return False
    if CARB_JET.search(blob) or re.search(r"enduro|moottoripyör|motorcykel", published, re.I):
        row["kind"] = "motorcycle"
        row["buyers"] = ["rider"]
    return True


def buyers_for(kind: str, *parts: str) -> list[str]:
    """Who the shop's own category is for. A motorcycle row stays with the rider."""
    if kind == "motorcycle":
        return ["rider"]
    blob = " ".join(parts).lower()
    owner = any(bit in blob for bit in OWNER_BITS) or any(bit in blob for bit in BOTH_BITS)
    workshop = any(bit in blob for bit in WORKSHOP_BITS) or any(bit in blob for bit in BOTH_BITS)
    if not owner and not workshop:
        return ["owner", "workshop"] if kind == "part" else ["owner"]
    found = []
    if owner:
        found.append("owner")
    if workshop:
        found.append("workshop")
    return found


def kind_for(*parts: str) -> str:
    blob = " ".join(parts).lower()
    if any(
        contains(blob, word)
        for word in ("motorcykel", "moottoripyör", "kypär", "hjälm", "helmet", "handske", "glove")
    ) or has_word(blob, "mc"):
        return "motorcycle"
    if any(
        contains(blob, word)
        for word in (
            "broms",
            "jarru",
            "filter",
            "suodatin",
            "olja",
            "öljy",
            "batteri",
            "däck",
            "dack",
            "rengas",
            "torkar",
            "pyyhin",
            "reservdel",
        )
    ) or has_word(blob, "oil") or has_word(blob, "akku"):
        return "part"
    return "accessory"


def published_specs(description: str) -> list[str]:
    bullets = bullet_specs(description)
    if bullets:
        return bullets
    sentence = re.split(r"(?<=[.!?])\s", plain(description), maxsplit=1)[0].strip()
    if len(sentence) < 12:
        return []
    return [sentence[:160]]


def motonet_rows(site: str, country: str, currency: str, queries: list[str], image_market: str | None) -> list[dict]:
    found: dict[str, dict] = {}
    href = re.compile(rf'href="(/(?:produkt|tuote)/[^"?]+\?product=([^"&]+))"')
    for query in queries:
        url = f"{site}/{'sok' if country == 'SE' else 'haku'}?q={quote(query)}"
        try:
            html = fetch(url, "text/html")
        except Exception as error:
            print("skip", country, query, type(error).__name__, flush=True)
            continue
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        if not match:
            print(country, query, 0, flush=True)
            continue
        payload = json.loads(match.group(1))
        cards: list = []
        for item in payload["props"]["pageProps"]["dehydratedState"]["queries"]:
            data = (item.get("state") or {}).get("data") or {}
            products = data.get("products") if isinstance(data, dict) else None
            if isinstance(products, list):
                cards = products
                break
        links = {product_id: path for path, product_id in href.findall(html)}
        rows = []
        for card in cards:
            if not isinstance(card, dict):
                continue
            product_id = card.get("id")
            name = card.get("name") if isinstance(card.get("name"), str) else ""
            price = money_from(card.get("price") if isinstance(card.get("price"), str) else "")
            path = links.get(product_id) if isinstance(product_id, str) else None
            specs = published_specs(card.get("description") if isinstance(card.get("description"), str) else "")
            if not name or price is None or not path or not specs:
                continue
            brand = card.get("brand") if isinstance(card.get("brand"), str) else ""
            category = card.get("categoryName") if isinstance(card.get("categoryName"), str) else ""
            category_url = card.get("categoryUrl") if isinstance(card.get("categoryUrl"), str) else ""
            image = None
            if image_market and isinstance(product_id, str) and re.fullmatch(r"[0-9A-Za-z-]+", product_id):
                image = (
                    "https://cdn.broman.group/api/image/v2/image/"
                    f"{image_market}/productcode/{product_id}/300/300/80/FFFFFF00.webp"
                )
            prefix = "motonet" if country == "SE" else f"motonet-{country.lower()}"
            rows.append(
                {
                    "id": f"{prefix}:{product_id}",
                    "name": plain(name)[:120],
                    "brand": plain(brand)[:40] or None,
                    "kind": kind_for(category_url, category, name),
                    "category": plain(category)[:60] or None,
                    "price": price,
                    "currency": currency,
                    "specs": specs,
                    "imageUrl": image,
                    "sourceUrl": urljoin(site, path),
                    "sellerName": "Motonet",
                    "sellerCountry": country,
                    "checkedAt": CHECKED,
                }
            )
            if len(rows) >= PER_QUERY:
                break
        print(country, query, len(rows), flush=True)
        for row in rows:
            found.setdefault(row["id"], row)
    return list(found.values())


APPAREL = re.compile(r"\b(t-shirt|tshirt|hoodie|keps|tröja|luvtröja)\b", re.I)


def customhoj_rank(row: dict) -> tuple[int, float, str]:
    name = row["name"].lower()
    category = (row.get("category") or "").lower()
    helmet = "helmet" in category or "kypär" in category
    if row["kind"] == "motorcycle" and helmet:
        priority = 0
    elif row["kind"] == "motorcycle" and any(word in name for word in ("handske", "glove")):
        priority = 1
    else:
        priority = 2
    return (priority, row["price"], row["name"])


def customhoj_rows() -> list[dict]:
    """Customhoj publishes its catalogue at the Shopify storefront /products.json."""
    found: dict[str, list[dict]] = {"part": [], "motorcycle": [], "accessory": []}
    for page in range(1, 9):
        try:
            raw = fetch(
                f"https://customhoj.se/products.json?limit=250&page={page}",
                "application/json",
            )
        except Exception as error:
            print("skip customhoj", page, type(error).__name__, flush=True)
            break
        products = json.loads(raw).get("products") or []
        print("customhoj page", page, len(products), flush=True)
        if not products:
            break
        for product in products:
            if not isinstance(product, dict):
                continue
            variants = [
                variant
                for variant in product.get("variants") or []
                if isinstance(variant, dict) and variant.get("available") and variant.get("price")
            ]
            if not variants:
                continue
            price = money_from(str(variants[0].get("price")))
            specs = list_specs(product.get("body_html") if isinstance(product.get("body_html"), str) else "")
            title = product.get("title") if isinstance(product.get("title"), str) else ""
            handle = product.get("handle") if isinstance(product.get("handle"), str) else ""
            product_id = product.get("id")
            product_type = product.get("product_type") if isinstance(product.get("product_type"), str) else ""
            if (
                price is None
                or not specs
                or not title
                or not handle
                or not isinstance(product_id, int)
                or APPAREL.search(f"{title} {product_type}")
            ):
                continue
            vendor = product.get("vendor") if isinstance(product.get("vendor"), str) else ""
            kind = kind_for(product_type, title)
            images = product.get("images") if isinstance(product.get("images"), list) else []
            src = images[0].get("src") if images and isinstance(images[0], dict) else None
            if isinstance(src, str) and src.startswith("//"):
                src = f"https:{src}"
            image = src if isinstance(src, str) and src.startswith("https://") else None
            found[kind].append(
                {
                    "id": f"customhoj:{product_id}",
                    "name": plain(title)[:120],
                    "brand": plain(vendor)[:40] or None,
                    "kind": kind,
                    "category": plain(product_type)[:60] or None,
                    "price": price,
                    "currency": "SEK",
                    "specs": specs,
                    "imageUrl": image,
                    "sourceUrl": f"https://customhoj.se/products/{handle}",
                    "sellerName": "Customhoj",
                    "sellerCountry": "SE",
                    "checkedAt": CHECKED,
                }
            )
    rows = []
    for group in found.values():
        rows.extend(sorted(group, key=customhoj_rank)[:CUSTOMHOJ_CAP])
    print("customhoj kept", len(rows), flush=True)
    return rows


HELMET_SKIP = re.compile(
    r"\b(mounts?|cares?|bags?|locks?|liners?|shields?|visors?|peaks?|covers?|pinlocks?|communicators?|headsets?)\b",
    re.I,
)
PART_WORDS = ("brake pad", "oil filter", "spark plug", "drive chain", "tyre", "tire")


def union_store() -> dict | None:
    """The address printed on Union Garage's contact page. The coordinates locate that address."""
    try:
        html = fetch("https://uniongaragenyc.com/pages/contact-us", "text/html")
    except Exception as error:
        print("skip union address", type(error).__name__, flush=True)
        return None
    text = plain(html)
    if "162 Elm Street" not in text or "Bridgeport" not in text or "06604" not in text:
        print("union contact page did not publish the Bridgeport address", flush=True)
        return None
    return {
        "name": "Union Garage",
        "address": "162 Elm Street",
        "city": "Bridgeport",
        "region": "CT",
        "postalCode": "06604",
        "country": "US",
        "latitude": 41.1792402,
        "longitude": -73.1923973,
    }


def union_rows(store: dict) -> list[dict]:
    """Union Garage publishes its catalogue at the Shopify storefront /products.json."""
    helmets: list[dict] = []
    parts: list[dict] = []
    for page in range(1, 9):
        try:
            raw = fetch(
                f"https://uniongaragenyc.com/products.json?limit=250&page={page}",
                "application/json",
            )
        except Exception as error:
            print("skip union", page, type(error).__name__, flush=True)
            break
        products = json.loads(raw).get("products") or []
        print("union page", page, len(products), flush=True)
        if not products:
            break
        for product in products:
            if not isinstance(product, dict):
                continue
            title = product.get("title") if isinstance(product.get("title"), str) else ""
            product_type = product.get("product_type") if isinstance(product.get("product_type"), str) else ""
            handle = product.get("handle") if isinstance(product.get("handle"), str) else ""
            product_id = product.get("id")
            variants = [
                variant
                for variant in product.get("variants") or []
                if isinstance(variant, dict) and variant.get("available") and variant.get("price")
            ]
            if not variants or not title or not handle or not isinstance(product_id, int):
                continue
            price = money_from(str(variants[0].get("price")))
            specs = list_specs(product.get("body_html") if isinstance(product.get("body_html"), str) else "")
            if price is None or not specs:
                continue
            helmet = re.search(r"\bhelmet\b", title, re.I) and not HELMET_SKIP.search(title)
            part = any(word in f"{title} {product_type}".lower() for word in PART_WORDS)
            if not helmet and not part:
                continue
            vendor = product.get("vendor") if isinstance(product.get("vendor"), str) else ""
            images = product.get("images") if isinstance(product.get("images"), list) else []
            src = images[0].get("src") if images and isinstance(images[0], dict) else None
            if isinstance(src, str) and src.startswith("//"):
                src = f"https:{src}"
            image = src if isinstance(src, str) and src.startswith("https://") else None
            row = {
                "id": f"union-garage:{product_id}",
                "name": plain(title)[:120],
                "brand": plain(vendor)[:40] or None,
                "kind": "motorcycle" if helmet else "part",
                "category": plain(product_type)[:60] or None,
                "price": price,
                "currency": "USD",
                "specs": specs,
                "imageUrl": image,
                "sourceUrl": f"https://uniongaragenyc.com/products/{handle}",
                "sellerName": "Union Garage",
                "sellerCountry": "US",
                "checkedAt": CHECKED,
                "stores": [store],
            }
            if helmet and len(helmets) < 20:
                helmets.append(row)
            elif part and len(parts) < 8:
                parts.append(row)
    helmets.sort(key=lambda row: (-len(row["specs"]), row["price"], row["name"]))
    print("union kept", len(helmets), "helmets", len(parts), "parts", flush=True)
    return helmets[:20] + parts


AUTOONE_OWNER = (
    "floor mat",
    "seat cover",
    "child restraint",
    "seat belt",
    "wiper",
    "dash cam",
    "towing",
    "recovery",
    "mirror",
    "air freshener",
)
AUTOONE_WORKSHOP = (
    "brake",
    "spark plug",
    "ignition",
    "wheel stud",
    "fuel pump",
    "engine oil",
    "shock",
    "strut",
    "suspension",
    "ball joint",
    "tie rod",
    "thermostat",
    "glow plug",
    "engine mount",
    "oil catch",
    "socket",
    "spanner",
    "screwdriver",
    "hand tool",
    "filter",
    "clutch",
    "alternator",
    "water pump",
    "gasket",
    "caliper",
)
# A driver orders these wear parts. A workshop orders the same parts for a client.
AUTOONE_WEAR = (
    "brake",
    "spark plug",
    "engine oil",
    "shock",
    "strut",
    "filter",
    "clutch",
    "glow plug",
    "caliper",
)
AUTOONE_PER_TYPE = 20


def autoone_rows() -> list[dict]:
    """Auto One publishes its Australian catalogue at the Shopify storefront /products.json."""
    try:
        home = fetch("https://www.autoone.com.au/", "text/html")
    except Exception as error:
        print("skip autoone home", type(error).__name__, flush=True)
        return []
    if '"active":"AUD"' not in home or 'Shopify.country = "AU"' not in home:
        print("autoone did not publish AUD in Australia", flush=True)
        return []
    kept: dict[str, list[dict]] = {}
    for page in range(1, 41):
        try:
            raw = fetch(
                f"https://www.autoone.com.au/products.json?limit=250&page={page}",
                "application/json",
            )
        except Exception as error:
            print("skip autoone", page, type(error).__name__, flush=True)
            break
        products = json.loads(raw).get("products") or []
        print("autoone page", page, len(products), flush=True)
        if not products:
            break
        for product in products:
            if not isinstance(product, dict):
                continue
            product_type = product.get("product_type") if isinstance(product.get("product_type"), str) else ""
            folded = product_type.lower()
            owner = any(word in folded for word in AUTOONE_OWNER)
            workshop = any(word in folded for word in AUTOONE_WORKSHOP)
            if any(word in folded for word in AUTOONE_WEAR):
                owner = True
                workshop = True
            if not owner and not workshop:
                continue
            bucket = product_type[:60] or "other"
            if len(kept.get(bucket, [])) >= AUTOONE_PER_TYPE:
                continue
            variants = [
                variant
                for variant in product.get("variants") or []
                if isinstance(variant, dict) and variant.get("available") and variant.get("price")
            ]
            if not variants:
                continue
            price = money_from(str(variants[0].get("price")))
            body = product.get("body_html") if isinstance(product.get("body_html"), str) else ""
            specs = list_specs(body) or published_specs(plain(body))
            title = product.get("title") if isinstance(product.get("title"), str) else ""
            handle = product.get("handle") if isinstance(product.get("handle"), str) else ""
            product_id = product.get("id")
            if price is None or not specs or not title or not handle or not isinstance(product_id, int):
                continue
            vendor = product.get("vendor") if isinstance(product.get("vendor"), str) else ""
            images = product.get("images") if isinstance(product.get("images"), list) else []
            src = images[0].get("src") if images and isinstance(images[0], dict) else None
            if isinstance(src, str) and src.startswith("//"):
                src = f"https:{src}"
            image = src if isinstance(src, str) and src.startswith("https://") else None
            buyers = []
            if owner:
                buyers.append("owner")
            if workshop:
                buyers.append("workshop")
            kept.setdefault(bucket, []).append(
                {
                    "id": f"autoone:{product_id}",
                    "name": plain(title)[:120],
                    "brand": plain(vendor)[:40] or None,
                    "kind": "part" if workshop and not owner else "accessory" if owner and not workshop else "part",
                    "category": plain(product_type)[:60] or None,
                    "price": price,
                    "currency": "AUD",
                    "specs": specs,
                    "imageUrl": image,
                    "sourceUrl": f"https://www.autoone.com.au/products/{handle}",
                    "sellerName": "Auto One",
                    "sellerCountry": "AU",
                    "checkedAt": CHECKED,
                    "buyers": buyers,
                }
            )
    rows = [row for group in kept.values() for row in group]
    print("autoone kept", len(rows), flush=True)
    return rows


def main() -> None:
    sweden = motonet_rows("https://www.motonet.se", "SE", "SEK", SE_QUERIES, "motswe")
    if len(sweden) < 20:
        raise SystemExit(f"Motonet Sweden returned {len(sweden)} products; catalogue file was not replaced")
    finland = motonet_rows("https://www.motonet.fi", "FI", "EUR", FI_QUERIES, None)
    shop = customhoj_rows()
    store = union_store()
    connecticut = union_rows(store) if store else []
    australia = autoone_rows()
    products = []
    for row in sweden + finland + shop + connecticut + australia:
        if "buyers" not in row:
            row["buyers"] = buyers_for(row["kind"], row.get("category") or "", row["name"])
        if not relevant(row):
            continue
        products.append(row)
    products.sort(key=lambda row: (row["kind"], row["currency"], row["price"], row["name"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": CHECKED,
                    "note": (
                        "Each product is a card the shop published on its own site, with the price "
                        "and specification lines on that page. Motonet Sweden and Motonet Finland "
                        "come from the search page. Customhoj, Union Garage and Auto One come from their "
                        "public Shopify catalogues. Auto One's prices are the Australian dollars its "
                        "own page says the shop uses. Union Garage's store address is the one on its "
                        "contact page in Bridgeport, Connecticut. The map point is the OpenStreetMap "
                        "location of that address. A car-owner row and a workshop row are the same "
                        "published product when the shop's category is a part either of them orders. "
                        "Prices stay in the currency the shop printed. DriveLinkUp does not sell the "
                        "product and has not verified it."
                    ),
                },
                "products": products,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("wrote", OUT, "products", len(products))


if __name__ == "__main__":
    main()

"""Re-checks every catalogue school against its own website.

    python3 scripts/catalogue/verify_freshness.py [--limit N] [--workers N]

For each school in data/*-schools/schools.json and
data/school-prices/school-prices.json it fetches the website and the price
source page, then records whether the site answers and whether the stored
lesson price still appears on the source page. Writes
data/catalogue-freshness.json; nothing in the catalogue files is changed.
"""

import argparse
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = ["nordic", "europe", "us", "uk", "australia"]
USER_AGENT = "DriveLinkUpCatalogueCheck/1.0 (+https://www.drivelinkup.com/kontakt)"
CTX = ssl.create_default_context()
LAX = ssl._create_unverified_context()  # some small-school sites ship broken chains
TAG = re.compile(r"<script.*?</script>|<style.*?</style>|<[^>]+>", re.S | re.I)
PRICE_LINK = re.compile(
    r"pris|priser|paket|kurs|shop|butik|price|pricing|tarif|preis|prijs|precio|prezzi|cennik|hinta|takst|rates|lesson|fahrstunde|lecon",
    re.I,
)
MAX_PRICE_PAGES = 6
DIGIT_GAP = re.compile(r"(?<=\d)[\s\u00a0\u202f.'’](?=\d{3}\b)")


def fetch(url: str, timeout: int = 15) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    for context in (CTX, LAX):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=context) as res:
                return res.status, res.read(400_000).decode("utf-8", "replace")
        except urllib.error.HTTPError as err:
            return err.code, ""
        except ssl.SSLError:
            continue
        except urllib.error.URLError as err:
            if isinstance(err.reason, ssl.SSLError) and context is CTX:
                continue
            return 0, ""
        except Exception:
            return 0, ""
    return 0, ""


def price_on_page(html: str, price: float) -> bool:
    text = DIGIT_GAP.sub("", TAG.sub(" ", html))
    whole = int(price)
    pattern = rf"(?<![\d.,]){whole}(?:[.,]\d{{1,2}})?(?![\d])"
    return re.search(pattern, text) is not None


def rows() -> list[dict]:
    out = []
    for name in FILES:
        data = json.loads((ROOT / f"data/{name}-schools/schools.json").read_text())
        for school in data["schools"]:
            out.append(
                {
                    "file": name,
                    "id": school["id"],
                    "website": school.get("website"),
                    "sourceUrl": school.get("sourceUrl"),
                    "price": school.get("lessonPrice"),
                    "storedStatus": school.get("websiteStatus"),
                }
            )
    prices = json.loads((ROOT / "data/school-prices/school-prices.json").read_text())
    for school in prices["schools"]:
        out.append(
            {
                "file": "school-prices",
                "id": school["id"],
                "website": school.get("website"),
                "sourceUrl": school.get("sourceUrl"),
                "price": (school.get("lesson") or {}).get("priceSek"),
                "storedStatus": school.get("status"),
                "listed": bool(school.get("listingIds")),
            }
        )
    return out


def price_links(html: str, base: str) -> list[str]:
    host = urllib.parse.urlsplit(base).hostname or ""
    links = []
    for href in re.findall(r'href=["\']([^"\'#]+)', html, re.I):
        url = urllib.parse.urljoin(base, href)
        parts = urllib.parse.urlsplit(url)
        if parts.scheme in ("http", "https") and parts.hostname == host and PRICE_LINK.search(parts.path):
            if url not in links:
                links.append(url)
    return links[:MAX_PRICE_PAGES]


def fetch_retry(url: str) -> tuple[int, str]:
    status, html = fetch(url)
    if status in (0, 429, 502, 503, 504):
        time.sleep(3)
        status, html = fetch(url, timeout=30)
    return status, html


def check(row: dict) -> dict:
    website = row["website"]
    if not website or not re.match(r"^https?://", website):
        return {**row, "site": "NO_WEBSITE", "priceStillShown": None}
    status, html = fetch_retry(website)
    site = "OK" if 200 <= status < 400 else "UNREACHABLE"
    price_seen = None
    if row["price"]:
        pages = [website]
        source = row["sourceUrl"] or website
        if source != website:
            source_status, source_html = fetch_retry(source)
            html = html + source_html
            pages.append(source)
        price_seen = bool(html) and price_on_page(html, row["price"])
        if not price_seen and html:
            for url in price_links(html, website):
                if url in pages:
                    continue
                _, page = fetch(url)
                if page and price_on_page(page, row["price"]):
                    price_seen = True
                    break
    return {**row, "site": site, "httpStatus": status, "priceStillShown": price_seen}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=48)
    args = parser.parse_args()
    todo = rows()
    if args.limit:
        todo = todo[: args.limit]
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for index, result in enumerate(pool.map(check, todo), 1):
            results.append(result)
            if index % 250 == 0:
                print(f"{index}/{len(todo)}", file=sys.stderr, flush=True)
    out = ROOT / "data/catalogue-freshness.json"
    out.write_text(
        json.dumps({"checkedAt": date.today().isoformat(), "schools": results}, ensure_ascii=False, indent=1)
    )
    summary: dict[str, dict[str, int]] = {}
    for result in results:
        bucket = summary.setdefault(result["file"], {})
        bucket[f"site_{result['site']}"] = bucket.get(f"site_{result['site']}", 0) + 1
        key = {True: "price_still_shown", False: "price_not_found", None: "no_price"}[result["priceStillShown"]]
        bucket[key] = bucket.get(key, 0) + 1
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()

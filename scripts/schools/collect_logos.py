#!/usr/bin/env python3
"""Read a driving school's logo from that school's own website.

The mark is kept only when the page links to it (a logo image, an apple
touch icon, a site icon, or an og:image). It identifies the school. It is
not a DriveLinkUp endorsement. Existing marks are left in place.

  python3 scripts/schools/collect_logos.py
"""

from __future__ import annotations

import json
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
LOGO_PATH = ROOT / "data" / "business-logos" / "logos.json"
SCHOOL_FILES = [
    "data/nordic-schools/schools.json",
    "data/europe-schools/schools.json",
    "data/uk-schools/schools.json",
    "data/us-schools/schools.json",
    "data/canada-schools/schools.json",
    "data/brazil-schools/schools.json",
    "data/australia-schools/schools.json",
    "data/school-prices/school-prices.json",
]
UA = "DriveLinkUp-directory/1.0 (+https://www.drivelinkup.com)"
CTX = ssl.create_default_context()
SKIP = (
    "googletagmanager",
    "facebook.com",
    "fbcdn.net",
    "cookiebot",
    "cookieinformation",
    "gstatic.com",
    "pfavico.ico",
    "wp-includes/",
    "gravatar.com",
    "doubleclick",
    "spacer",
    "blank.gif",
    "1x1",
    "pixel.gif",
    "s.w.org",
    "wix.com/favicon",
    "pfavico.ico",
    "default-favicon",
    "logo-default.png",
    "/themes/custom/",
    "ntsf-logo.png",
    "modele409/images/cer-logo",
    "cdn.website-start.de/s/img/logo.gif",
)


class Marks(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.icons: list[tuple[int, str]] = []
        self.og: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag == "link":
            rel = data.get("rel", "").lower()
            href = data.get("href")
            if not href:
                return
            if "apple-touch-icon" in rel:
                self.icons.append((0, href))
            elif "icon" in rel:
                self.icons.append((1, href))
        elif tag == "meta" and data.get("property", "").lower() == "og:image" and data.get("content"):
            self.og = data["content"]
        elif tag == "img":
            blob = " ".join(
                [data.get("src", ""), data.get("alt", ""), data.get("class", ""), data.get("id", "")]
            ).lower()
            if data.get("src") and any(word in blob for word in ("logo", "logotyp", "logga", "brand")):
                self.icons.append((0, data["src"]))


def absolute(base: str, href: str | None) -> str | None:
    if not href:
        return None
    href = href.strip()
    if href.startswith(("data:", "javascript:")):
        return None
    joined = urljoin(base, href)
    parsed = urlparse(joined)
    if parsed.scheme not in ("http", "https"):
        return None
    if any(piece in joined.lower() for piece in SKIP):
        return None
    return joined


def logo_from(website: str) -> str | None:
    request = Request(website, headers={"User-Agent": UA, "Accept": "text/html"})
    with urlopen(request, timeout=8, context=CTX) as response:
        final = response.geturl()
        html = response.read(220_000).decode("utf-8", "replace")
    parser = Marks()
    try:
        parser.feed(html)
    except Exception:
        return None
    for _, href in sorted(parser.icons, key=lambda item: item[0]):
        logo = absolute(final, href)
        if logo:
            return logo
    return absolute(final, parser.og)


def school_rows() -> list[dict]:
    rows = []
    for relative in SCHOOL_FILES:
        payload = json.loads((ROOT / relative).read_text())
        rows.extend(school for school in payload.get("schools", []) if isinstance(school, dict))
    return rows


def missing_targets(by_key: dict[str, str]) -> dict[str, list[str]]:
    """Website -> school ids that still have no stored mark."""
    wanted: dict[str, list[str]] = {}
    for school in school_rows():
        website = school.get("website")
        if not isinstance(website, str) or not website.startswith(("http://", "https://")):
            continue
        keys = [school.get("id"), *(school.get("listingIds") or [])]
        pending = [key for key in keys if isinstance(key, str) and key and key not in by_key]
        if not pending:
            continue
        wanted.setdefault(website, [])
        for key in pending:
            if key not in wanted[website]:
                wanted[website].append(key)
    return wanted


def main() -> None:
    payload = json.loads(LOGO_PATH.read_text())
    by_key = payload.get("byKey")
    if not isinstance(by_key, dict):
        by_key = {}
    targets = missing_targets(by_key)
    print(f"sites to read {len(targets)}", flush=True)
    found = 0

    def job(website: str) -> tuple[str, str | None]:
        try:
            return website, logo_from(website)
        except Exception:
            return website, None

    with ThreadPoolExecutor(max_workers=24) as pool:
        futures = [pool.submit(job, website) for website in targets]
        for index, future in enumerate(as_completed(futures), start=1):
            website, logo = future.result()
            if logo:
                for key in targets[website]:
                    by_key.setdefault(key, logo)
                found += 1
            if index % 200 == 0:
                payload["byKey"] = by_key
                payload["meta"] = {
                    "collectedAt": "2026-11-26",
                    "note": "Logo URLs read from each business's own website. Identification only.",
                }
                LOGO_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
                print(f"read {index}/{len(targets)} with a mark {found}", flush=True)

    payload["byKey"] = by_key
    payload["meta"] = {
        "collectedAt": "2026-11-26",
        "note": "Logo URLs read from each business's own website. Identification only.",
    }
    LOGO_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print("wrote", LOGO_PATH, "keys", len(by_key), "new sites", found)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Collect Nordic driving schools from public pages, then keep contact
facts that appear on each school's own website.

Norway starts from Norges Trafikkskoleforbund's public member finder.
Denmark starts from Foreningen af Frie Kørelærere's public member list
(Fyn). Iceland starts from the Ísland.is list of operating theory
schools. Finland's association page publishes names and street
addresses and no school websites, so those schools are not listed.

Email, phone and a lesson price are recorded only when that school's
website also shows them. Nothing here is a verified permit.
"""

from __future__ import annotations

import hashlib
import json
import re
import ssl
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "nordic-schools" / "schools.json"
NTSF = Path("/tmp/ntsf-schools.json")
UA = "DriveLinkUp catalogue research (https://www.drivelinkup.com)"
CTX = ssl.create_default_context()

CAR = {
    "Klasse B": "B",
    "Klasse BE": "BE",
    "Klasse A1/A2/A": "A",
    "Klasse AM146": "AM",
    "Klasse AM147": "AM",
}
HEAVY = {
    "Klasse C1": "C1",
    "Klasse C1E": "C1E",
    "Klasse C": "C",
    "Klasse CE": "CE",
    "Klasse D1": "D1",
    "Klasse D1E": "D1E",
    "Klasse D": "D",
    "Klasse DE": "DE",
}
EMAIL_RE = re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", re.I)
BAD_LOCAL = {
    "bruker",
    "navn",
    "name",
    "example",
    "test",
    "email",
    "mail",
    "user",
    "username",
    "yourname",
    "epost",
    "din-epost",
}
BAD_DOMAIN = (
    "domene.no",
    "epost.no",
    "example.com",
    "example.no",
    "example.org",
    "plesk.page",
    "wixpress.com",
    "sentry.io",
    "schema.org",
    "godaddy.com",
    "wordpress.com",
    "wordpress.org",
)
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg")
SMALL_WORDS = {"i", "og", "av", "af", "och", "von"}
PRICE_CAP = {"NO": (400, 2500), "DK": (200, 1500), "IS": (2000, 30000), "FI": (20, 200)}
CHECKED = "2026-10-28"


def fetch(url: str, timeout: int = 12, limit: int = 180_000) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as res:
        ctype = (res.headers.get("content-type") or "").lower()
        if "html" not in ctype and "text" not in ctype and "json" not in ctype:
            return ""
        return res.read(limit).decode("utf-8", "replace")


def title_place(value: str) -> str:
    parts = []
    for index, word in enumerate(value.split()):
        lower = word.lower()
        if index > 0 and lower in SMALL_WORDS:
            parts.append(lower)
        elif lower:
            parts.append(lower[:1].upper() + lower[1:])
    return " ".join(parts)


def school_id(country: str, key: str, name: str) -> str:
    digest = hashlib.sha1(key.encode()).hexdigest()[:6]
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]
    return f"{country.lower()}{digest}-{slug or 'skole'}"


def city_from_address(block: str) -> str:
    text = unescape(re.sub(r"<br\s*/?>", "\n", block, flags=re.I))
    text = re.sub(r"<[^>]+>", " ", text)
    lines = [re.sub(r"\s+", " ", line).strip(" ,") for line in text.splitlines()]
    lines = [line for line in lines if line]
    for line in reversed(lines):
        match = re.search(r"\b\d{4}\s+(.+)$", line)
        if match:
            return title_place(match.group(1))
    return ""


def parse_norway(html: str) -> list[dict]:
    cards = html.split('<section class="company output-filter"')[1:]
    schools = []
    seen = set()
    for card in cards:
        name_m = re.search(r'data-name="([^"]+)"', card)
        if not name_m:
            continue
        name = unescape(name_m.group(1)).strip()
        web_m = re.search(r'class="web"[\s\S]{0,500}?href="(https?://[^"]+)"', card)
        website = web_m.group(1).strip() if web_m else None
        if website and " " in website:
            website = website.split()[0]
        alts = re.findall(r'alt="([^"]+)"', card)
        categories = []
        heavy = []
        for alt in alts:
            if alt in CAR:
                code = CAR[alt]
                if code == "A":
                    for piece in ("A1", "A2", "A"):
                        if piece not in categories:
                            categories.append(piece)
                elif code not in categories:
                    categories.append(code)
            if alt in HEAVY and HEAVY[alt] not in heavy:
                heavy.append(HEAVY[alt])
        address_m = re.search(r"<article>([\s\S]*?)</article>", card)
        city = city_from_address(address_m.group(1)) if address_m else ""
        if not city:
            center = re.search(r'class="center">\s*([^<]+)', card)
            city = title_place(unescape(center.group(1)).strip()) if center else ""
        key = (website or name).lower()
        if key in seen:
            continue
        seen.add(key)
        schools.append(blank(school_id("no", key, name), "NO", name, city, website, categories, heavy))
    return schools


def parse_iceland(html: str) -> list[dict]:
    rows = re.findall(
        r"<tr[\s\S]*?<p[^>]*>([^<]+)</p>[\s\S]*?<a href=\"(https?://[^\"]+)\"[^>]*>",
        html,
    )
    schools = []
    seen = set()
    for name, href in rows:
        name = unescape(re.sub(r"<[^>]+>", "", name))
        name = unescape(re.sub(r"\s+", " ", name)).strip()
        if not name or name.lower().startswith("ökuskólar"):
            continue
        host = (urlparse(href).hostname or "").lower()
        if host.endswith("island.is"):
            continue
        key = host.removeprefix("www.")
        if not key or key in seen:
            continue
        seen.add(key)
        schools.append(blank(school_id("is", key, name), "IS", name, "", href.split("?")[0], ["B"], []))
    return schools


def parse_denmark(html: str) -> list[dict]:
    rows = html.split("ffk-user-directory__row")[1:]
    schools = []
    seen = set()
    for row in rows:
        link = re.search(
            r'ffk-user-directory__company[\s\S]*?<a href="(https?://[^"]+)"[^>]*>\s*([^<]+)',
            row,
        )
        if not link:
            continue
        website, name = link.group(1).strip(), unescape(link.group(2)).strip()
        host = (urlparse(website).hostname or "").lower()
        if "ffk.nu" in host or "aveo.dk" in host or not host:
            continue
        key = host.removeprefix("www.")
        if key in seen:
            continue
        seen.add(key)
        address = re.search(r'ffk-user-directory__address[\s\S]*?<div>([^<]+)</div>', row)
        city = ""
        if address:
            place = unescape(address.group(1)).strip()
            if place and not re.search(r"\d", place):
                city = title_place(place.split(",")[0])
        schools.append(blank(school_id("dk", key, name), "DK", name, city, website, [], []))
    return schools


def blank(
    sid: str,
    country: str,
    name: str,
    city: str,
    website: str | None,
    categories: list[str],
    heavy: list[str],
) -> dict:
    currency = {"NO": "NOK", "DK": "DKK", "FI": "EUR", "IS": "ISK"}[country]
    return {
        "id": sid,
        "country": country,
        "name": name,
        "city": city,
        "website": website,
        "categories": categories,
        "heavy": heavy,
        "email": None,
        "phone": None,
        "lessonPrice": None,
        "lessonMinutes": None,
        "currency": currency,
        "sourceUrl": website,
        "checkedAt": CHECKED,
    }


def email_ok(mail: str) -> bool:
    mail = mail.lower().strip(".")
    if "@" not in mail or any(mail.endswith(ext) for ext in IMAGE_EXT):
        return False
    if re.search(r"@[0-9]?x[0-9]", mail):
        return False
    local, domain = mail.split("@", 1)
    if local in BAD_LOCAL or "dintrafikkskole" in local:
        return False
    if any(part in domain for part in BAD_DOMAIN) or "." not in domain:
        return False
    return True


def emails_on(page: str) -> list[str]:
    mailto = EMAIL_RE.findall(" ".join(re.findall(r"mailto:([^\"'\s>]+)", page, re.I)))
    body = EMAIL_RE.findall(page)
    found = []
    for raw in mailto + body:
        mail = raw.lower().strip(".")
        if email_ok(mail) and mail not in found:
            found.append(mail)
    return found


def host_of(url: str | None) -> str:
    return (urlparse(url or "").hostname or "").lower().removeprefix("www.")


def domain_matches(email: str, website: str | None) -> bool:
    host = host_of(website)
    domain = email.split("@", 1)[1]
    if not host:
        return False
    host_label = host.split(".")[0]
    email_label = domain.split(".")[0]
    return (
        host.endswith(domain)
        or domain.endswith(host)
        or (len(host_label) > 3 and host_label in domain)
        or (len(email_label) > 3 and email_label in host)
    )


def choose_email(page: str, website: str | None) -> str | None:
    found = emails_on(page)
    for mail in found:
        if domain_matches(mail, website):
            return mail
    mailto = [mail.lower().strip(".") for mail in EMAIL_RE.findall(" ".join(re.findall(r"mailto:([^\"'\s>]+)", page, re.I)))]
    for mail in mailto:
        if email_ok(mail):
            return mail
    return found[0] if found else None


def valid_digits(digits: str, length: int) -> bool:
    if len(digits) != length or not digits.isdigit():
        return False
    if digits[0] in "01":
        return False
    if len(set(digits)) < 3:
        return False
    return True


def phone_on(page: str, country: str) -> str | None:
    text = unescape(re.sub(r"<[^>]+>", " ", page))
    text = re.sub(r"\s+", " ", text)
    if country == "NO":
        for raw in re.findall(r"tel:(\+47[0-9\s]+)", page, re.I):
            digits = re.sub(r"\D", "", raw)
            if digits.startswith("47"):
                digits = digits[2:]
            if valid_digits(digits, 8):
                return f"+47{digits}"
        for match in re.finditer(r"\+47[\s\-]*(\d[\d\s]{6,12})", text):
            digits = re.sub(r"\D", "", match.group(1))[:8]
            if valid_digits(digits, 8):
                return f"+47{digits}"
        labeled = re.search(
            r"(?:telefon|tlf\.?|phone)[^0-9]{0,24}(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})",
            text,
            re.I,
        )
        if labeled:
            digits = re.sub(r"\D", "", labeled.group(1))
            if valid_digits(digits, 8):
                return f"+47{digits}"
        return None
    if country == "DK":
        for raw in re.findall(r"tel:(\+?45?[0-9\s]+)", page, re.I):
            digits = re.sub(r"\D", "", raw)
            if digits.startswith("45") and len(digits) > 8:
                digits = digits[2:]
            if valid_digits(digits, 8):
                return f"+45{digits}"
        return None
    if country == "IS":
        for raw in re.findall(r"tel:(\+?354?[0-9\s]+)", page, re.I):
            digits = re.sub(r"\D", "", raw)
            if digits.startswith("354"):
                digits = digits[3:]
            if valid_digits(digits, 7):
                return f"+354{digits}"
        return None
    return None


def lesson_price(page: str, country: str) -> tuple[int | None, int | None]:
    text = unescape(re.sub(r"<[^>]+>", " ", page))
    text = re.sub(r"\s+", " ", text)
    window = re.search(
        r"(?:kjøretime|kjoretime|køretime|kørelektion|ajotunti|ökutími).{0,80}?(\d[\d\s.]{2,7})\s*(?:kr|nok|dkk|isk|,-)",
        text,
        re.I,
    )
    if not window:
        return None, None
    amount = int(re.sub(r"\D", "", window.group(1)))
    low, high = PRICE_CAP[country]
    if amount < low or amount > high:
        return None, None
    minutes = re.search(r"(\d{2})\s*min", window.group(0), re.I)
    return amount, int(minutes.group(1)) if minutes else None


def city_from_page(page: str, country: str, name: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", page))
    text = re.sub(r"\s+", " ", text)
    if country == "DK":
        named = re.search(r"\bi\s+([A-ZÆØÅ][A-Za-zÆØÅæøå.\-]{2,})", text)
        if named:
            return title_place(named.group(1))
        match = re.search(r"\b\d{4}\s+([A-ZÆØÅ][A-Za-zÆØÅæøå.\-]+)", text)
        if match:
            return title_place(match.group(1))
    if country == "IS":
        for place in (
            "Reykjavík",
            "Kópavogur",
            "Hafnarfjörður",
            "Akureyri",
            "Reykjanesbær",
            "Garðabær",
            "Mosfellsbær",
            "Egilsstaðir",
            "Selfoss",
            "Akranes",
        ):
            if place.lower() in text.lower():
                return place
        if "kópavog" in name.lower():
            return "Kópavogur"
        if "austurland" in name.lower():
            return "Austurland"
    return ""


def categories_from_page(page: str, country: str, existing: list[str]) -> list[str]:
    if existing:
        return existing
    text = unescape(re.sub(r"<[^>]+>", " ", page)).lower()
    found = []
    if country == "DK" and any(word in text for word in ("køreskole", "koereskole", "kørekort", "korekort")):
        found.append("B")
    if country == "IS" and "ökuskó" in text:
        found.append("B")
    if any(word in text for word in ("motorcykel", "motorsykkel", "kategori a")):
        for code in ("A1", "A2", "A"):
            if code not in found:
                found.append(code)
    return found


def enrich(school: dict) -> dict:
    website = school.get("website")
    if not website or not str(website).startswith("http"):
        school["websiteStatus"] = "NO_WEBSITE"
        return school
    try:
        page = fetch(website)
    except Exception:
        school["websiteStatus"] = "SITE_UNREACHABLE"
        return school
    if not page:
        school["websiteStatus"] = "SITE_UNREACHABLE"
        return school
    school["email"] = choose_email(page, website)
    school["phone"] = phone_on(page, school["country"])
    price, minutes = lesson_price(page, school["country"])
    school["lessonPrice"] = price
    school["lessonMinutes"] = minutes
    if not school["city"]:
        school["city"] = city_from_page(page, school["country"], school["name"])
    school["categories"] = categories_from_page(page, school["country"], school["categories"])
    school["sourceUrl"] = website
    school["websiteStatus"] = "OK"
    return school


def drop_shared_emails(schools: list[dict]) -> None:
    hosts: dict[str, set[str]] = defaultdict(set)
    for school in schools:
        email = school.get("email")
        if email:
            hosts[email].add(host_of(school.get("website")))
    shared = {email for email, rows in hosts.items() if len(rows) > 1}
    for school in schools:
        if school.get("email") in shared:
            school["email"] = None


def main() -> None:
    schools = parse_norway(json.loads(NTSF.read_text())["str"])
    print(f"parsed norway {len(schools)}", flush=True)
    try:
        iceland = parse_iceland(fetch("https://island.is/oekuskolar-listi", timeout=20, limit=400_000))
        print(f"parsed iceland {len(iceland)}", flush=True)
        schools.extend(iceland)
    except Exception as err:
        print(f"iceland skipped {err}", flush=True)
    try:
        denmark = parse_denmark(fetch("https://ffk.nu/koereskoler/", timeout=20, limit=400_000))
        print(f"parsed denmark {len(denmark)}", flush=True)
        schools.extend(denmark)
    except Exception as err:
        print(f"denmark skipped {err}", flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(enrich, school) for school in schools]
        for future in as_completed(futures):
            future.result()
            done += 1
            if done % 50 == 0:
                print(f"fetched {done}", flush=True)
    drop_shared_emails(schools)
    schools.sort(key=lambda row: (row["country"], row["city"], row["name"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "meta": {
                    "collectedAt": CHECKED,
                    "note": (
                        "Contact details are kept only when they appear on the school's own website. "
                        "Names, places and class labels come from the public page that links to that website. "
                        "Nothing here is a verified permit. Finland's association list has no school websites, so it is not included."
                    ),
                },
                "schools": schools,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    ok = sum(1 for row in schools if row.get("websiteStatus") == "OK")
    emailed = sum(1 for row in schools if row.get("email"))
    print(f"wrote {len(schools)} ok {ok} email {emailed}", flush=True)


if __name__ == "__main__":
    main()

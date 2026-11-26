#!/usr/bin/env python3
"""Translate messages/en.json public catalogs. Placeholders stay intact."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EN_PATH = ROOT / "messages" / "en.json"
CACHE_DIR = ROOT / "scripts" / ".i18n-cache"

LOCALES = {
    "nb": "no",
    "da": "da",
    "fi": "fi",
    "de": "de",
    "fr": "fr",
    "nl": "nl",
    "es": "es",
    "it": "it",
    "pl": "pl",
}

PUBLIC_NAMESPACES = {
    "common",
    "locationHub",
    "publicHome",
    "faqPage",
    "aboutPage",
    "pricingPage",
    "forSkolor",
    "handledareInfo",
    "blogPage",
    "instructorPreview",
    "publishedPrice",
    "googleReviews",
    "southernSwedenPage",
    "westernNorthernSwedenPage",
    "landing",
    "privacyPage",
    "termsPage",
    "forInstructorsPage",
    "categoryLanding",
    "schoolContact",
    "schoolProfile",
    "instructorsPage",
    "consentBanner",
}

PH = re.compile(r"\{([a-zA-Z0-9_]+)\}")
SKIP = re.compile(r"^(?:[A-Z0-9]{1,3}|DriveLinkUp|SEK|AM|BE)?$")


def protect(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        token = f"__PH_{key}__"
        mapping[token] = match.group(0)
        return token

    return PH.sub(repl, text), mapping


def unprotect(text: str, mapping: dict[str, str]) -> str:
    out = text
    for token, original in mapping.items():
        out = out.replace(token, original)
        out = out.replace(token.lower(), original)
        out = out.replace(token.upper(), original)
    return out


def should_skip(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if SKIP.fullmatch(stripped):
        return True
    if not re.search(r"[A-Za-zÀ-ÿ]", stripped):
        return True
    return False


def mymemory_translate(text: str, target: str) -> str:
    q = urllib.parse.quote(text[:450])
    url = f"https://api.mymemory.translated.net/get?q={q}&langpair=en|{target}"
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DriveLinkUpI18n/1.0"})
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
            translated = data.get("responseData", {}).get("translatedText")
            if translated:
                return translated
            last_error = RuntimeError(str(data)[:200])
        except Exception as error:  # noqa: BLE001
            last_error = error
        time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"translate failed: {last_error}")


def collect_strings(value: object, out: set[str]) -> None:
    if isinstance(value, dict):
        for child in value.values():
            collect_strings(child, out)
    elif isinstance(value, list):
        for child in value:
            collect_strings(child, out)
    elif isinstance(value, str):
        out.add(value)


def apply_map(value: object, translated: dict[str, str]) -> object:
    if isinstance(value, dict):
        return {key: apply_map(child, translated) for key, child in value.items()}
    if isinstance(value, list):
        return [apply_map(child, translated) for child in value]
    if isinstance(value, str):
        return translated.get(value, value)
    return value


def load_cache(locale: str) -> dict[str, str]:
    path = CACHE_DIR / f"{locale}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_cache(locale: str, cache: dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{locale}.json").write_text(json.dumps(cache, ensure_ascii=False, indent=0))


def translate_locale(locale: str, google_tl: str, strings: list[str]) -> dict[str, str]:
    cache = load_cache(locale)
    missing = [text for text in strings if text not in cache]
    print(f"{locale}: {len(missing)} to translate, {len(cache)} cached", flush=True)
    for index, text in enumerate(missing, start=1):
        if should_skip(text):
            cache[text] = text
        else:
            protected, mapping = protect(text)
            cache[text] = unprotect(mymemory_translate(protected, google_tl), mapping)
            time.sleep(0.15)
        if index % 25 == 0:
            save_cache(locale, cache)
            print(f"{locale}: {index}/{len(missing)}", flush=True)
    save_cache(locale, cache)
    return cache


def main() -> None:
    catalog = json.loads(EN_PATH.read_text())
    public: set[str] = set()
    for name in PUBLIC_NAMESPACES:
        if name in catalog:
            collect_strings(catalog[name], public)
    ordered = sorted(public)
    print(f"public strings {len(ordered)}", flush=True)
    for locale, google_tl in LOCALES.items():
        mapping = translate_locale(locale, google_tl, ordered)
        out = apply_map(catalog, mapping)
        path = ROOT / "messages" / f"{locale}.json"
        path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()

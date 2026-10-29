"""Drop catalogue rows that are not driving schools for licence categories A–E."""

from __future__ import annotations

import re
from urllib.parse import urlparse

NON_DRIVING_NAME = re.compile(
    r"postnord|nobina\b|presto\b|"
    r"åkeri\b|akeri\b|åkeritjänst|akeritjanst|"
    r"\blogistic|\blogistik\b|"
    r"dp world|"
    r"transdev|omnibuss|"
    r"go-ahead|"
    r"vy buss|"
    r"bygg ab|"
    r"freedomoutdoor|"
    r"konkurslist",
    re.I,
)
NON_DRIVING_HOST = re.compile(
    r"postnord|nobina\.|presto\.|nickesakeritjanst|widensakeri|nettbuss|"
    r"jrlogistic|foodtankers|formalogistics|transdev|uddevalla-omnibus|go-ahead\.|"
    r"gbos\.|freedomoutdoor|konkurslistan|creditsafe|sundsvalljobb|"
    r"dhl\.|schenker|fedex|ups\.com|bring\.|budbee",
    re.I,
)


def host_of(url: str | None) -> str:
    if not url:
        return ""
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def is_non_driving_school(name: str, website: str | None = None) -> bool:
    if NON_DRIVING_NAME.search(name or ""):
        return True
    host = host_of(website)
    return bool(host and NON_DRIVING_HOST.search(host))

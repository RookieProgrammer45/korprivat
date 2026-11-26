#!/usr/bin/env python3
"""Restore {placeholders} after machine translation mangled __PH_token__ markers."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIAS = {
    "land": "country",
    "country": "country",
    "name": "name",
    "count": "count",
    "price": "price",
    "minutes": "minutes",
    "date": "date",
    "year": "year",
    "city": "city",
    "average": "average",
}

TOKEN = re.compile(r"__PH[_]?([A-Za-z0-9]+)__", re.I)


def restore(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        raw = match.group(1).lower()
        key = ALIAS.get(raw, raw)
        return "{" + key + "}"

    return TOKEN.sub(repl, text)


def walk(value: object) -> object:
    if isinstance(value, dict):
        return {key: walk(child) for key, child in value.items()}
    if isinstance(value, list):
        return [walk(child) for child in value]
    if isinstance(value, str):
        return restore(value)
    return value


def main() -> None:
    for path in sorted((ROOT / "messages").glob("*.json")):
        data = json.loads(path.read_text())
        cleaned = walk(data)
        dumped = json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n"
        path.write_text(dumped)
        leftover = len(re.findall(r"__PH", dumped))
        print(f"{path.name}: leftover markers {leftover}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Apply en->locale maps onto leaves that are still English. Keys stay put."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EN = json.loads((ROOT / "messages" / "en.json").read_text())
WORK = ROOT / "scripts" / ".i18n-work"


def apply(en_v: object, loc_v: object, mapping: dict[str, str]) -> object:
    if type(en_v) is not type(loc_v):
        return loc_v
    if isinstance(en_v, dict) and isinstance(loc_v, dict):
        return {key: apply(en_v[key], loc_v[key], mapping) if key in en_v else loc_v[key] for key in loc_v}
    if isinstance(en_v, list) and isinstance(loc_v, list):
        return [apply(a, b, mapping) for a, b in zip(en_v, loc_v)]
    if isinstance(en_v, str) and isinstance(loc_v, str) and loc_v == en_v:
        translated = mapping.get(en_v)
        if translated and translated.strip():
            return translated
    return loc_v


def main() -> None:
    for path in sorted(WORK.glob("map-*.json")):
        locale = path.name.removeprefix("map-").removesuffix(".json")
        if not re.fullmatch(r"[a-z]{2}", locale):
            print(f"skip {path.name}")
            continue
        catalog_path = ROOT / "messages" / f"{locale}.json"
        if not catalog_path.exists():
            print(f"skip missing catalog {locale}")
            continue
        mapping = json.loads(path.read_text())
        if not isinstance(mapping, dict):
            raise SystemExit(f"{path} is not an object")
        current = json.loads(catalog_path.read_text())
        merged = apply(EN, current, mapping)
        catalog_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
        changed = 0

        def count(a: object, b: object) -> None:
            nonlocal changed
            if isinstance(a, dict) and isinstance(b, dict):
                for key in a:
                    if key in b:
                        count(a[key], b[key])
            elif isinstance(a, list) and isinstance(b, list):
                for x, y in zip(a, b):
                    count(x, y)
            elif isinstance(a, str) and isinstance(b, str) and a != b:
                changed += 1

        count(current, merged)
        print(f"{locale}: mapped {len(mapping)} strings, changed {changed} leaves")


if __name__ == "__main__":
    main()

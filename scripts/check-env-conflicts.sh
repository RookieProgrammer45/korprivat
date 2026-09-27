#!/usr/bin/env bash
# Warn if the shell exports a var that .env.local also sets.
# Next.js will not override existing env vars with .env.local, so
# a stale shell export silently wins.

set -euo pipefail

if [ ! -f .env.local ]; then
  echo "No .env.local found. Skipping."
  exit 0
fi

CONFLICTS=0
UNSET_KEYS=()

report() {
  echo "⚠  $2"
  echo "   → unset $1"
  CONFLICTS=$((CONFLICTS + 1))
  UNSET_KEYS+=("$1")
}

check_key() {
  local key="$1" file_val="$2" shell_val
  printenv "$key" >/dev/null 2>&1 || return 0
  shell_val="$(printenv "$key")"
  if [ -z "$shell_val" ] && [ -n "$file_val" ]; then
    report "$key" "$key is EMPTY in shell but set in .env.local — shell wins"
  elif [ "$shell_val" != "$file_val" ]; then
    report "$key" "$key differs between shell and .env.local — shell wins"
  fi
}

while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# || -z "${line//[[:space:]]/}" ]] && continue
  key="${line%%=*}"; key="${key#"${key%%[![:space:]]*}"}"; key="${key%"${key##*[![:space:]]}"}"
  [ -z "$key" ] && continue
  file_val="${line#*=}"
  [[ "$file_val" =~ ^[\"\'].*[\"\']$ ]] && file_val="${file_val:1:${#file_val}-2}"
  check_key "$key" "$file_val"
done < .env.local

# Also flag NEXT_PUBLIC_* shell exports missing from .env.local
while IFS= read -r key; do
  [ -z "$key" ] && continue
  grep -q "^${key}=" .env.local 2>/dev/null && continue
  report "$key" "$key is set in shell but absent from .env.local (NEXT_PUBLIC_* leak)"
done < <(env | awk -F= '/^NEXT_PUBLIC_/ {print $1}')

if [ "$CONFLICTS" -eq 0 ]; then
  echo "✓ No shell/.env.local conflicts."
  exit 0
fi
echo ""
echo "$CONFLICTS conflict(s). Run:"
echo "  unset ${UNSET_KEYS[*]}"
echo "Then restart dev."
exit 1

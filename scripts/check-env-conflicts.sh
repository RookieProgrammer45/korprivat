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
while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments and blanks
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue

  key="${line%%=*}"
  # Strip whitespace
  key="$(echo "$key" | xargs)"
  [ -z "$key" ] && continue

  # Is it exported in the shell?
  if printenv "$key" > /dev/null 2>&1; then
    shell_val="$(printenv "$key")"
    file_val="${line#*=}"
    # Strip surrounding quotes from .env.local values for comparison
    if [[ "$file_val" =~ ^\".*\"$ ]] || [[ "$file_val" =~ ^\'.*\'$ ]]; then
      file_val="${file_val:1:${#file_val}-2}"
    fi
    if [ -z "$shell_val" ] && [ -n "$file_val" ]; then
      echo "⚠  $key is EMPTY in shell but set in .env.local — shell wins"
      CONFLICTS=$((CONFLICTS + 1))
    elif [ "$shell_val" != "$file_val" ]; then
      echo "⚠  $key differs between shell and .env.local — shell wins"
      CONFLICTS=$((CONFLICTS + 1))
    fi
  fi
done < .env.local

if [ "$CONFLICTS" -eq 0 ]; then
  echo "✓ No shell/.env.local conflicts."
else
  echo ""
  echo "$CONFLICTS conflict(s). Run: unset <KEY> and restart dev."
  exit 1
fi

#!/usr/bin/env bash
set -euo pipefail

# Prisma migrate deploy takes a Postgres advisory lock. Concurrent Vercel builds
# or a stale idle-in-transaction session can cause P1002; retry until the lock clears.
max_attempts=12
sleep_seconds=30

for attempt in $(seq 1 "$max_attempts"); do
  if npx prisma migrate deploy; then
    break
  fi
  if [[ "$attempt" -eq "$max_attempts" ]]; then
    echo "prisma migrate deploy failed after ${max_attempts} attempts" >&2
    exit 1
  fi
  echo "migrate deploy attempt ${attempt} failed (often P1002); retrying in ${sleep_seconds}s…" >&2
  sleep "$sleep_seconds"
done

exec next build --webpack

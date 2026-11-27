# ADR-008: Catalogue read model

## Status
Accepted

## Date
2026-11-27

## Context
The public directory compares published prices: driving schools, cars, spare parts, inspections, tires, taxi-driver training, and private leases. Each row exists only because a publisher's own page stated it. The monthly refresh re-reads that page and opens a pull request. It does not write to Postgres.

Measured on 2026-11-27, the JSON files the server actually imports total about 7 MB. The largest file is the Europe school list at 1.9 MB. Private leases are 53 rows and 29 KB. A separate `data/regional-schools` tree is about 20 MB and is not imported.

Postgres already stores accounts, sessions, bookings, payments, and verification. Those tables are queried per request, indexed, and migrated one bounded context at a time.

## Decision
Published catalogues stay versioned JSON, loaded once when the server process starts, then filtered in memory.

- A page receives a capped slice. The homepage shows 20 offers. Parts show 60. Dealers show 60, or 120 when a model or place is selected. Lease, tire, taxi, and inspection pages show the filtered set, which is under 100 rows.
- A client component receives that slice as props. It does not import a catalogue file. `import type` is allowed.
- An imported catalogue file stays under 8 MB. The imported files together stay under 12 MB. Crossing either budget means split the file by country, or move that one catalogue to Postgres with an index on country and currency and the same page cap. Do not import `data/regional-schools` into a page.
- Accounts, bookings, payments, and verification stay in Postgres. A published price is not a booking amount and does not get a row there.

## Alternatives considered

### Store every catalogue in Postgres now
Rejected. A query to Neon for 53 lease rows adds a network hop and a failure mode the file does not have. At the measured size, the in-memory filter is the faster read. Postgres remains the store for data that changes with a user action.

### Send the whole file to the browser
Rejected. The homepage, parts, and dealer pages already slice before render. Putting the school or parts file in a client bundle would slow the first load as those files grow.

## Consequences
- A new catalogue follows the lease file: one JSON snapshot, a server page, a render cap, and a monthly re-read that opens a pull request.
- Ordering inside one currency can learn from listings people open after analytics consent. The learned shift is capped. Currency groups stay separate. The stored amount is unchanged. If the rank table is missing or slow, the page shows the published price order.
- The budget test in `tests/unit/catalogue-read-budget.test.ts` fails the build when an imported file or the client bundle would cross this decision.

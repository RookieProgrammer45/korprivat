# 01 — Architecture (stack-agnostic) and Gate 0

**Req ID prefix:** AR

## Gate 0 — Repository discovery (first task, blocking)

The MVP is live; this pack does not know its stack. Before any framework-specific work or migrations:

1. Inventory the repository: framework and version, package manifests, route inventory, data layer (ORM/SQL/NoSQL), auth mechanism, i18n system, payment surface (if any), test tooling, deployment target.
2. Produce a one-page `specs/ARCHITECTURE-NOTES.md` recording the discovered stack and any deviations from this pack's assumptions.
3. Every [PROPOSED] item below is written stack-agnostically; translate to the discovered stack in Gate 0 notes. **Do not propose a rewrite of a live application.**

## Logical architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Client (existing web app)                                    │
├─────────────────────────────────────────────────────────────┤
│ Public API layer                                             │
│  discovery / profiles / booking / auth                      │
├───────────────┬───────────────┬─────────────┬───────────────┤
│ Booking       │ Verification │ Connector   │ Review/Ops    │
│ Engine        │ Module       │ Framework   │ Console        │
│ (spec 03)     │ (spec 04)    │ (spec 05)   │ (spec 06)      │
├───────────────┴───────────────┴─────────────┴───────────────┤
│ Data layer (spec 02 logical schema)                          │
├─────────────────────────────────────────────────────────────┤
│ Integrations (all optional, capability-flagged)             │
│  e-ID broker │ Twilio Verify │ register APIs │ calendar APIs │
│  vendor connectors (mock in staging, disabled in prod)       │
└─────────────────────────────────────────────────────────────┘
```

## Module boundaries

| Module | Owns | Never owns |
|---|---|---|
| Booking Engine | booking states, capability-flag gating, concurrency, reconciliation job | verification decisions |
| Verification Module | verification_records, evidence refs, review queue, permission gating, badge logic | booking state |
| Connector Framework | adapter interface, event ingestion, milestone state per connector, mock adapters | business rules |
| Review/Ops Console | admin review queue UI, audit log surface | direct data mutation outside audited actions |

## Cross-cutting decisions

- **AR-1 Idempotency:** all mutating API endpoints accept an idempotency key; connectors dedupe events on (school_connection_id, provider_event_id) where available, else (school_connection_id, external_ref, event_type, payload_hash).
- **AR-2 Event logs:** append-only `booking_events` (raw integration events) and `booking_state_transitions` (state changes) per the data model (spec 02); the reconciliation job (spec 03 §9) consumes both.
- **AR-3 Feature flags:** every external dependency (e-ID broker, Twilio, register APIs, connectors, payment) is behind a capability/feature flag so the app runs with all of them disabled.
- **AR-4 Sensitive identifiers:** personnummer-type identifiers are stored encrypted, never logged, never rendered in support views (spec 04 §8).
- **AR-5 Server-side authorization:** every endpoint checks role + school scope server-side (spec 02 §3).
- **AR-6 Time:** all timestamps UTC ISO-8601; market-local display in the client.
- **AR-7 Reference stack (optional, only if Gate 0 finds no live repo to respect):** TypeScript + Next.js + Postgres + Prisma/Drizzle — a default, not a requirement. Do not migrate an existing app to it.

## Failure behavior (applies to all integration points)

| Failure | Behavior |
|---|---|
| e-ID broker down | e-ID step unavailable; onboarding falls back to manual review path (spec 04) |
| Twilio down | booking confirmation blocked, browsing unaffected (release test e) |
| Register API down / timeout | previously verified + valid evidence → offering stays live, flagged re-check; never verified → stays blocked (spec 04 §4) |
| Connector event stream stale (detected staleness window exceeded) | instant booking disabled for that school until authority restored (spec 05 §6) |
| Reconciliation conflict | ops alert within defined window; never auto-overwrite a newer confirmed state |

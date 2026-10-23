# 05 — Connector Framework

**Req ID prefix:** CN. Implements plan §4–§6. **Golden rule: outreach is not access.** All connectors ship as dependencies; prod stays disabled until milestone 5. Passing mock tests is **not** milestone evidence for a real vendor connector — milestones 1–3 require vendor-side artifacts (agreement, credentials, sandbox) and milestones 4–5 run against the vendor's real test/production environment.

## 1. The three Swedish candidate surfaces (unranked)

| Surface | Status notes |
|---|---|
| STR Optima Smart | Launch announced for 1 Sept 2026 (STR); **post-launch production status not separately confirmed**; no API statement found; outreach sent 22 Oct 2026 |
| LGD/TC (TC Admin; TABS-Sweden closes 31 Dec 2026) | Outreach sent; **do not build a TABS-Sweden adapter** (sunset verified: [tabs.teoricentralen.se](https://tabs.teoricentralen.se/)); no Norwegian sunset found — do not extend the Swedish sunset to Norway |
| Trafikskola Online | Outreach sent; double-booking protection advertised; no marketplace API published ([trafikskolaonline.se](https://www.trafikskolaonline.se/sv/trafikskola)) |

The historical Optima agreement's API listing is evidence about Optima only ([avtal-optima.pdf](https://str.se/globalassets/aktuellt/dokument/optima/avtal-optima.pdf)) — not carried into any current-product conversation. Deployment counts are unverified for all three. All slots unranked until access and pilot-school coverage discriminate.

## 2. Adapter interface (all connectors implement)

```
interface VendorConnector {
  vendor_key, market
  readAvailability(school_connection_ref, filters) -> InventorySlice
  createBooking(school_connection_ref, offering, student_ref, idempotency_key) -> BookingResult(external_ref, state)
  rescheduleBooking(school_connection_ref, external_ref, new_slot, idempotency_key) -> BookingResult
  cancelBooking(school_connection_ref, external_ref, idempotency_key) -> BookingResult
  getAuthoritativeState(school_connection_ref, external_ref) -> BookingSnapshot   // reconciliation source of truth
  ingestEvent(raw_event) -> [booking_events]   // per §4 ordering protocol
  healthCheck() -> {freshness, staleness_window}
}
```

Every method is optional-by-capability; a connector declares its capability set, which maps to `school_capabilities` rows.

## 3. The five-milestone chain (a connector is "delivered" only when all five complete)

| # | Milestone | Evidence required |
|---|---|---|
| 1 | Vendor access and commercial use approved (signed agreement completes this milestone only) | signed agreement |
| 2 | Documentation, credentials, testing environment available | vendor-issued sandbox credentials |
| 3 | Connector implemented | code + integration tests against vendor sandbox |
| 4 | **Failure tests pass** (§5) — run against the **vendor's real test environment**, not mocks | test run records |
| 5 | Pilot confirms bookings become authoritative in the external system | pilot report |

Until milestone 5: every slot is an explicit dependency, not a capability. `prod_enabled=false`; `transaction_capable` cannot be granted. No authorized, transaction-capable API has been verified for any candidate in any market.

## 4. Event ordering protocol (implementable spec)

- **Identity:** prefer the provider's **stable event identifier** (`provider_event_id`); dedupe on (school_connection_id, provider_event_id). Where absent, dedupe on (school_connection_id, external_ref, event_type, payload_hash).
- **Scoping:** `external_ref` is scoped by `school_connection` — the same vendor booking id under two connections never collides.
- **Ordering:** use the provider's revision/sequence field when available; otherwise compare `occurred_at` against the **latest accepted authoritative state transition, regardless of state** (a newer cancellation advances the ordering watermark too, not only confirmations). An event older than that watermark is recorded `rejected_stale` and never applied. For providers with neither a reliable sequence nor unambiguous occurrence timestamps, do not guess order — retrieve the authoritative state via `getAuthoritativeState` and reconcile from it.
- **Durability:** every raw event lands in `booking_events` with `received_at`, `occurred_at`, and `processing_status` before any processing; processing status transitions are idempotent.
- **Resync:** a `resync(school_connection_ref)` operation pulls the vendor's authoritative state via `getAuthoritativeState` and reports drift to the reconciliation job — never overwrites the **latest accepted authoritative state of any kind** directly.

## 5. Milestone-4 failure tests (against the vendor's real test environment)

1. Concurrent external/internal booking of the same resource cannot both confirm.
2. Duplicate and out-of-order events cannot duplicate bookings or charges, and cannot overwrite the **latest accepted authoritative state of any kind** — **including the newer-cancellation-then-older-confirmation case** (BK-7).
3. Rescheduling releases old resources and reserves new ones atomically.
4. Payment after reservation expiry has a deterministic outcome (spec 03 §4: booking stays expired; payment flagged late_captured; ops route).
5. Revoked vendor access or detected stale inventory **disables instant booking** until authority is restored or another verified control applies (allocation/native).

## 6. Staleness and degradation

- Each connector defines a staleness window (e.g., availability older than X minutes).
- On exceeded staleness: instant booking disabled for that school; fallback ladder applies (spec 03 §3); ops alert. Degradation never silently shows stale availability as bookable.

## 7. Calendar tier (Google/Microsoft) — supplementary

- **Google Calendar API** ([events.insert scopes](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)): write accepts `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned` (verified against the official method docs). **Least-privilege selection is an adapter configuration gate** — choose the narrowest accepted scope per integration design at build time and record the choice in ARCHITECTURE-NOTES; do not default to the full `calendar` scope. Read/free-busy: `freebusy.query` accepts `calendar.readonly` / `calendar.freebusy` / `calendar.events.freebusy` ([freebusy docs](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)); returns busy periods only, not details. `events.watch` channels expire and must be renewed.
- **Microsoft Graph** ([getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0)): free/busy, 5–1440-min intervals; >1000 entries → error 5006; organizational accounts supported, personal-account support limited. Webhook subscriptions have a max lifetime, must be renewed, max 1000 active per mailbox ([change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-overview)). **On-premises Exchange is invisible to Graph.**
- Product rule: calendar sync sets `calendar_sync` flag only. It never establishes booking authority (NN5). A `calendar_sync` school can still offer instant booking only where another verified control applies.

## 8. Vendor-neutral connection onboarding (R3)

Onboarding asks each school which system it uses, then offers the supported connection route: transaction-capable / read-only / calendar-sync / unsupported-with-fallbacks. Never requires a specific vendor; never blocks onboarding on connector availability (manual + calendar routes always exist). Connection authorization records the delegating school-side user (DM school_connections.delegated_by_user_id).

## Acceptance scenarios

- **CN-1:** Given a connector whose milestone-4 tests passed only against mocks, when prod enablement is attempted, then it is refused — vendor-environment test records are required.
- **CN-2:** Given availability older than the connector's staleness window, when a student views the school, then instant booking is hidden and the fallback ladder renders.
- **CN-3:** Given a school on an unsupported vendor, when onboarding, then the school completes onboarding via manual/calendar routes with correct capability flags.
- **CN-4:** Given an out-of-order event stream (newer cancel, then older confirm), when ingested, then the older event is recorded `rejected_stale` and the cancellation stands.
- **CN-5 (dual-connection scoping):** Given the same vendor `external_ref` arriving under two different `school_connection` records, when ingested, then they are processed as distinct bookings (connection-scoped uniqueness) with no dedupe collision.

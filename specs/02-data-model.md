# 02 — Data Model (proposed logical schema)

**Req ID prefix:** DM. This is a **proposed logical schema**, not an existing database or a ready-to-run migration. Translate to the Gate-0-discovered data layer. Every invariant listed here must be enforced in code or constraints — do not leave them for the UI.

## Entity overview

```
users ──< memberships >── schools ──< offerings
  │                        │
  │                        ├──< school_capabilities (1 row per capability flag)
  │                        ├──< school_connections >── connectors
  │                        ├──< resources (instructors/vehicles/locations)
  │                        └──< allocations (protected inventory slices)
  ├──< instructor_profiles ──< verification_records
  ├──< students
  ├──< bookings ──< booking_resource_assignments
  │      ├──< booking_events
  │      ├──< booking_state_transitions
  │      └──< payment_records
  └──< earnings_entries
verification_records ──< evidence_refs
review_queue_items
platform_admins (authorization distinct from school membership)
audit_log (append-only)
```

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_provider | text | 'broker_eid' \| 'password' \| 'magic' (existing MVP auth is preserved) |
| external_auth_ref | text | broker subject id; unique per provider |
| display_name | text | |
| phone | text | E.164 |
| phone_verified_at | timestamptz | Twilio Verify result |
| email | text | |
| email_verified_at | timestamptz | |
| date_of_birth | date | nullable; only when required by a market rule |
| is_minor | bool | derived at write time from DOB + market; drives guardian-consent flows |
| guardian_consent | jsonb | {granted, evidence_ref, scope, captured_at} — see spec 04 §7 |
| created_at / updated_at | timestamptz | |

Invariant: a `students` record may exist with verified contact but no e-ID (release test b).

### memberships (school-scoped roles)
| Column | Type |
|---|---|
| id | uuid PK |
| user_id | uuid FK users |
| school_id | uuid FK schools |
| role | text — 'owner' \| 'admin' \| 'instructor' \| 'staff' |
| created_at | timestamptz |

Unique: (user_id, school_id). **Roles are school-scoped** — a platform-level user has no implicit rights in any school (AR-5).

### platform_admins
| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK | |
| permissions | text[] | 'review_queue' \| 'ops' \| 'connectors' \| 'billing_read' … |
| granted_by / granted_at | | audited |

**Platform-admin authorization is a separate table, not a school membership** — an admin has no school-scope rights and a school owner has no platform rights.

### schools
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| legal_name | text | |
| organization_number | text | country-specific format; indexed |
| country_code | char(2) | |
| city / lat / lng | | discovery filters |
| listing_status | text | 'draft' \| 'pending_verification' \| 'active' \| 'suspended' |
| profile | jsonb | descriptions, categories AM–BE, pricing display, languages |
| external_review_source | text | nullable — B4: third-party review source; rights basis unverified → do not render until resolved |
| workspace_onboarding | jsonb | native-mode readiness evidence: {completed_steps[], onboarding_completed_at} — null until complete |

### school_capabilities — one row per flag (canonical flag set)
| Column | Type |
|---|---|
| school_id FK | |
| capability | text — 'transaction_capable' \| 'read_only' \| 'allocation' \| 'native' \| 'calendar_sync' \| 'manual' |
| enabled | bool |
| connector_id | uuid FK connectors, nullable |
| set_by | 'admin' \| 'connector_milestone' \| 'school' |
| updated_at | timestamptz |

Unique: (school_id, capability). Invariants: `transaction_capable` can only be enabled by a connector at milestone 5 (spec 05 §3) — never by a school or admin manually; `allocation` requires an active allocation row (below) whose controller has accepted; `native` requires the school's School Booking Workspace onboarding complete.

### connectors
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| vendor_key | text | 'str_optima_smart' \| 'lgd_tc_admin' \| 'trafikskola_online' \| 'tabs_as_norway' \| … |
| product | text | product generation — never conflate (e.g. Optima ≠ TABS ≠ Smart) |
| market | char(2) | |
| milestone | int | 0–5, see spec 05 §3; 0 = not started |
| state | text | 'dependency' \| 'investigating' \| 'agreement_signed' \| 'sandbox' \| 'implemented' \| 'delivered' \| 'blocked' |
| milestone_evidence | jsonb[] | per-milestone evidence refs (agreement ref, sandbox credentials ref, vendor-env test run records, pilot report) — mock runs are never milestone evidence |
| prod_enabled | bool | **false until milestone 5** (NN4) |

### school_authorizations (commercial authorization — distinct from verification and from GDPR consent)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| granted_scopes | text[] | 'availability_display' \| 'inquiry_collection' \| 'request_to_book' \| 'transactional_booking' \| 'payment_collection' — empty array = directory-only |
| authorized_by_user_id | uuid FK | the school representative who granted — **server-side identified, never client-supplied** |
| evidence_ref | text | dated authorization/complaint evidence (dated record reference) — **independent of verification evidence; may exist without a verification record** (a school need not onboard to record a restriction) |
| effective_from / withdrawn_at | timestamptz | withdrawal is recorded, never deleted |
| history | jsonb[] | full grant/withdraw/suspend audit — withdrawal never erases prior grants |

Invariants: **directory visibility and bookability are separate** — a school can be listed with zero granted scopes (directory-only). **A working vendor connector, verified permit, or school account never enables booking automatically** — booking actions require the matching granted scope. **Withdrawal is scope-specific:** removing a scope removes only that scope's surfaces/actions; **directory-only applies when no scopes remain** (spec 03 §3 action-to-scope mapping is canonical). Withdrawal must disable the affected entry points **server-side**, and survive refresh/re-import of school data. Absence or withdrawal of authorization → the affected surface is removed, never an unauthorized request/contact fallback.

### cancellation_policies (school-approved, versioned)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| version | int | one active version per school (or per offering) |
| deadline_type | text | 'elapsed_hours_before' \| 'local_clock_cutoff_previous_business_day' \| 'none' \| custom school wording |
| deadline_value | jsonb | e.g. {hours: 24} or {cutoff: '13:00', calendar: 'business_days'} — **"by 13:00 the previous business day" is NOT equivalent to "24 hours before"** (a Monday lesson cuts off Friday 13:00 under a Mon–Fri calendar) |
| timezone | text | school's timezone; cutoffs evaluated in school-local time |
| business_calendar | jsonb | approved business-day/holiday calendar + exceptions — school-confirmed, never invented |
| late_cancellation_charge | jsonb | school-confirmed rules only |
| wording / source / approved_at | text | school-provided wording, source, approval date |
| state | text | 'draft' \| 'active' \| 'withdrawn' |

Invariants: the public profile displays the school's active policy **verbatim**; an unknown policy must **not** inherit an unapproved platform default ("24 hours" is not a default), and **no backend fallback may apply one** — the explicit unresolved-policy outcome: directory visibility remains allowed, but transactional checkout and instant booking are unavailable pending school approval; the policy text is simply not displayed (never shown with a warning). A policy **snapshot** attaches to each booking at creation; later policy changes never alter existing bookings. For a directory-only school, booking-policy presentation is removed rather than shown with a warning.

### school_connections
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| connector_id | uuid FK, nullable | null for manual/calendar routes |
| route | text | 'transaction_capable' \| 'read_only' \| 'calendar_sync' \| 'manual' |
| state | text | 'pending' \| 'authorized' \| 'degraded' \| 'revoked' |
| delegated_by_user_id | uuid | the school-side user who authorized the connection (delegated school-account authorization) |
| authorized_at / revoked_at | timestamptz | |
| external_account_ref | text | vendor-side tenant/account id |

One active connection per (school, route). A school may hold several connections on different routes.

### verification_records (the heart of spec 04)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| check_type | text | see enum below |
| subject_type | text | 'school' \| 'instructor' \| 'user' \| 'student' \| 'payout_recipient' |
| subject_id | uuid | FK to the subject table |
| method | text | 'bolagsverket_firmateckning' \| 'transportstyrelsen_eservice' \| 'str_hitta' \| 'trafikom_tarkista' \| 'fstyr_aktindsigt' \| 'twilio_verify' \| 'eid_broker' \| 'document_review' \| 'manual_review' \| … |
| status | text | 'pass' \| 'fail' \| 'pending' \| 'expired' \| 'revoked' |
| evidence_ref | text | protected reference (ID of evidence_refs row) |
| valid_from / valid_until | timestamptz | expiry drives re-check scheduling |
| checked_at | timestamptz | |
| reviewer_id | uuid | nullable; set for manual review outcomes |
| scope | jsonb | country, categories (e.g. ['B','BE']), location — permission is matched to legal entity + applicable location/category/scope, not just a similar school name |

check_type enum: `company_exists` \| `signatory_authority` \| `school_teaching_permit` \| `instructor_teaching_permit` \| `school_affiliation` \| `identity` \| `contact_verification` \| `guardian_consent` \| `payout_kyc` \| `association_membership` (secondary signal — badge only, never gates onboarding).

### evidence_refs
| Column | Type |
|---|---|
| id | uuid PK |
| verification_record_id | uuid FK |
| kind | text — 'api_response_hash' \| 'screenshot' \| 'document_hash' \| 'manual_note' \| 'external_protected_ref' |
| storage_ref | text | protected object store ref; external provider vault ref where the document stays with the provider |
| retention_until | timestamptz | per check type (spec 04 §8) |

**Document-storage policy (canonical):** full identity documents are not stored **by default**. Documentary permit review (e.g. Danish påtegning) may temporarily collect an authorized document during review; the retained artifact is the **result + a protected reference** (hash or external vault ref), and the raw document is deleted on review completion per retention config (release test f constrains the default; temporary authorized collection is an explicit workflow state, never silent).

### instructor_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| school_id | uuid FK, nullable | affiliation where rules require it (B3 fix) |
| listing_status | text | same lifecycle as schools |
| categories | text[] | |

### students
| id | uuid PK | user_id FK | market | learner_eligibility jsonb |

### resources — the bookable things (native/allocation modes need these)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| kind | text | 'instructor_slot' \| 'vehicle' \| 'location' |
| ref_id | uuid | FK to instructor_profile / vehicle record / location record |
| buffer_rules | jsonb | prep/travel buffers per kind (school rules) |
| active | bool | |

### availability (recurring + overrides)
| Column | Type |
|---|---|
| id | uuid PK |
| school_id / resource_id | uuid FKs |
| rule_type | text — 'recurring' \| 'override' \| 'block' |
| weekday / start_time / end_time | recurring template |
| specific_date / interval | overrides and blocks |
| source | 'school' \| 'connector' \| 'calendar_sync' |

### offerings
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| category | text | AM–BE |
| lesson_type | text | |
| price | jsonb | {amount, currency} — explicit currency, never inferred |
| duration_minutes | int | base lesson duration; the booking's end time is derived from this + buffers |
| permitted_location_id | uuid FK, nullable | the offering's permitted location (scope-matched, E1) |
| required_resources | jsonb | [{kind: 'instructor_slot' \| 'vehicle' \| 'location', count}] — the bundle that must be atomically reserved at booking creation |
| booking_mode | text | 'instant' \| 'request' \| 'contact' — derived at read time from capabilities + verification state; stored value is advisory |
| active | bool | false until activation gates pass (NN1) |

Invariant: an offering's category must be covered by the school permit's verification scope (E1) — category changes re-run scope checks and can disable the offering.

### vehicles
| id | uuid PK | school_id FK | label | gearbox | categories text[] | active bool |

### locations
| id | uuid PK | school_id FK | label | lat / lng | pickup_zone jsonb | active bool |

`resources.ref_id` targets `instructor_profiles`, `vehicles`, or `locations` by `kind`.

### allocations (protected inventory slices — the verified-allocation mode)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK | |
| offering_id | uuid FK | the slice belongs to a specific offering |
| resource_id | uuid FK | |
| window_start / window_end | timestamptz | |
| controller_user_id | uuid | who controls the slice (school-side owner) |
| accepted_at | timestamptz | null until the controller accepts — an allocation does not back bookings until accepted |
| state | text | 'offered' \| 'held' \| 'consumed' \| 'withdrawn' |
| conflict_policy | text | 'exclusive' — one booking per allocation window; enforced by DB exclusion constraint |

Invariant: an allocation may back at most one non-cancelled booking (exclusion constraint on overlapping windows per allocation).

**Resource-conflict enforcement (canonical, spans modes):** the real guard is per **resource + occupied interval (including buffers and active holds)**, not per allocation — two different allocations, or a native booking and an allocation booking, competing for the same instructor/vehicle/location must not both commit. Implement as a DB exclusion constraint over resource-occupancy rows (booking_resource_assignments + active holds + buffers) or an equivalent serialized reservation transaction. Test: two distinct allocation IDs targeting the same resource and window → exactly one commits (BK-3b).

### holds (resource reservations for pending instant bookings)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK | the pending booking owning the hold |
| resource_id | uuid FK | |
| window_start / window_end | timestamptz | includes applicable buffers |
| expires_at | timestamptz | equals the booking TTL |
| state | text | 'active' \| 'committed' \| 'released' |

Lifecycle: created atomically with the pending booking; **committed** on confirmation (becomes the booking_resource_assignment); **released** on expiry/cancellation (system job). Active holds participate in the resource-conflict exclusion constraint. A pending instant booking without an active hold is invalid.

### bookings
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| offering_id | uuid FK | |
| student_id | uuid FK | |
| school_id | uuid FK | |
| booking_state | text | see transition table, spec 03 §2 |
| payment_state | text | **separate from booking state** — 'none' \| 'authorized' \| 'captured' \| 'refunded' \| 'voided' \| 'disputed' |
| origin | text | 'marketplace' \| 'school_direct' — acquisition origin |
| ingestion_method | text | 'marketplace_checkout' \| 'connector_import' \| 'manual' — separate from origin |
| external_ref | text | vendor booking ID when a connector created it; **scoped by school_connection — unique on (school_connection_id, external_ref), never globally** |
| school_connection_id | uuid FK, nullable | the connection that created/owns the external ref (replaces connector_id on bookings) |
| idempotency_key | text | unique |
| currency | char(3) | explicit per booking — do not infer |
| start_time / end_time | timestamptz | |
| price_snapshot | jsonb | amount, currency, cancellation tiers |
| guardian_consent_ref | uuid | FK to booking_guardian_consents — booking-level consent where the booker is a minor (spec 04 §7) |
| cancellation_policy_snapshot | jsonb | immutable copy of the active policy version at booking creation: {policy_version_id, deadline_type, deadline_value, timezone, business_calendar, computed_deadline, wording} — later policy changes never alter existing bookings |
| cancellation_deadline | timestamptz | computed at creation from the snapshot (e.g. Friday 13:00 school-local for a Monday 10:00 lesson under an approved Mon–Fri calendar) |
| commitment_route | text | nullable — the recorded control/commitment route for this booking: 'connector' \| 'allocation' \| 'native' \| 'external_manual'; distinguishes instant-control routes from manual external commitments for rescheduling and reconciliation |
| created_at / updated_at | timestamptz | |

Invariant: importing never initiates a charge; commission follows documented `origin` (spec 03 §5). `origin`/`ingestion_method` are **nullable** — migration marks unknown provenance as null/unknown, and null `origin` never triggers commission (no invented attribution).

### booking_resource_assignments
| id | uuid PK | booking_id FK | resource_id FK | allocation_id FK nullable | created_at |

A booking may hold multiple assignments (instructor + vehicle + location). Rescheduling must reassign atomically.

### booking_guardian_consents
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK | |
| guardian_user_id | uuid FK | the authenticated guardian — identity alone is not proof of guardianship |
| relationship_authority_evidence_ref | uuid | FK to evidence_refs — what relationship/authority evidence was collected (per-market, counsel-reviewed rules) |
| consent_scope | jsonb | exactly what the consent covers: account creation, this booking, data processing |
| captured_at | timestamptz | |

Invariant: a minor's booking cannot reach `confirmed` without a booking_guardian_consents row where market rules require one.

### booking_state_transitions (append-only — the audit of state changes)
| id | uuid PK | booking_id FK | from_state / to_state | trigger | actor_type | actor_id | preconditions_met jsonb | created_at |

### payment_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK | |
| provider | text | TBD — no provider assumed (NN6) |
| provider_ref | text | |
| state | 'authorized' \| 'captured' \| 'refunded' \| 'voided' \| 'disputed' | authoritative-source-derived only |
| exception_flags | text[] | e.g. 'late_captured' — a payment captured after booking expiry; never a booking-state change |
| amount / currency | | |
| recorded_from | 'authoritative_record' | never invented |

**Late-payment ops route:** a payment_record with `late_captured` creates an `ops_tasks` row (see below) with the two allowed resolutions — void/refund, or a new booking if resources are free and eligibility passes. No automatic confirmation.

### ops_tasks
| Column | Type |
|---|---|
| id | uuid PK |
| kind | text — 'late_captured_payment' \| 'reconciliation_conflict' \| 'stale_connector' \| 'review_escalation' |
| ref_type / ref_id | polymorphic reference |
| state | 'open' \| 'resolved' \| 'rejected' |
| assigned_to / created_at / resolved_at | |

### booking_events (append-only raw integration events)
| Column | Type |
|---|---|
| id | uuid PK |
| school_connection_id | uuid FK |
| provider_event_id | text | **stable provider event identifier where available** |
| external_ref | text | school-connection-scoped vendor booking id |
| event_type | text |
| provider_revision | text | provider sequence/revision where available |
| payload_hash | text |
| received_at / occurred_at | timestamptz | |
| processing_status | text — 'received' \| 'processed' \| 'rejected_stale' \| 'rejected_duplicate' |

Unique: (school_connection_id, provider_event_id) where provided; (school_connection_id, external_ref, event_type, payload_hash) otherwise. Stale events (older than the **latest accepted authoritative state transition, regardless of state** — a newer cancellation advances the watermark too) are recorded with `rejected_stale`, never applied.

### earnings_entries
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK | |
| source | text | 'authoritative_record' only — proposed view (NN6) |
| gross / commission / payout | int | minor units, plus currency |
| payout_status | text | from authoritative settlement records only |

### review_queue_items
| id | uuid PK | verification_record_id FK | reason | state ('open' \| 'resolved' \| 'rejected') | assigned_to | created_at / resolved_at |

### audit_log (append-only)
| id | uuid PK | actor_user_id | action | entity_type / entity_id | before/after jsonb | created_at |

## Migration / backfill rules (live MVP) — non-destructive

- **Preserve history:** existing bookings keep their historical states (completed, cancelled, …), amounts, and payment records. Do not reset terminal states, do not rewrite `origin`/`ingestion_method` where the source data establishes them, and do not touch financial history.
- **Unknown provenance stays unknown:** where the public-interface audit could not establish a field (booking-authority evidence, payment provenance), backfill writes an explicit `unverified`/null marker — never an invented value. Existing active schools map to `listing_status='pending_verification'` until evidence exists (future bookability is gated; historical transactions are untouched).
- **No fabricated evidence or capabilities:** no verification_records, capability flags, or connector rows are created by migration.
- **No retro-confirmation:** no existing booking is retro-confirmed as authoritative (B1) — unknown booking-authority evidence is marked unknown, and the affected school shows request-to-book/contact modes until a control route applies.
- **Migration tests (required):** terminal states preserved; financial history and totals unchanged; no new charges, commissions, or payment-state changes triggered by migration; gated schools cannot create new instant bookings.

## Critical indexes

- `verification_records (subject_type, subject_id, check_type)` — gating lookups
- `verification_records (status, valid_until)` — re-check scheduler
- `bookings (school_connection_id, external_ref)`, `booking_events (school_connection_id, provider_event_id)` — dedupe (connection-scoped, never global external_ref)
- `booking_state_transitions (booking_id, created_at)` — event-ordering watermark lookups
- `allocations (offering_id, window_start/end)` + exclusion constraint — conflict prevention
- `schools (country_code, listing_status)`, `offerings (school_id, active)` — discovery
- `memberships (user_id, school_id)` unique

## Release-test hooks

Every §8.7 test maps to a schema capability: (a) signatory gating → memberships + verification_records; (f) evidence_refs stores hash+ref, not image (default); (h) PRH coverage gap → review_queue_items; (i)/(j)/(j2) → check_type/method values with scope jsonb.

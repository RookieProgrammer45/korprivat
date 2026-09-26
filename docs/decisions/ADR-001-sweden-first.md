# ADR-001: Sweden-first region and product vocabulary

## Status
Accepted

## Date
2026-09-26

## Context
`docs/architecture.md` and `AGENTS.md` described a UK-first marketplace (GBP, DVSA, parental guardian consent). The live product and schema are Sweden-first: SEK pricing, Trafikverket/Transportstyrelsen vocabulary, and the Swedish **handledare** (adult supervisor for övningskörning) role alongside learners and schools/instructors.

## Decision
DriveLinkUp is **Sweden-first**.

- Currency and fee math: **SEK** (see existing `src/lib/business/booking-fees.ts`).
- Marketplace roles on `UserProfile`: `STUDENT` | `INSTRUCTOR` | `HANDLEDARE` (plus school listed via instructor/school signup path / `providerRole`).
- Adult-supervisor flow for minors / supervised practice: **HandledareEnrollment**, not parental `GuardianConsent`.
- Regulatory framing: Trafikverket / Transportstyrelsen, not DVSA/UK defaults.
- Multi-region remains a future concern; do not encode UK defaults in docs or schema.

## Alternatives Considered

### Keep UK as the architecture default, Sweden as a locale
- Pros: Matches older draft docs.
- Cons: Contradicts shipped product, Prisma fields, and copy.
- Rejected: Docs must follow the live system when reconciling in place.

## Consequences
- Update `AGENTS.md`, `docs/architecture.md`, and verification flow docs to Sweden vocabulary.
- Fee examples and payment fields use SEK until Organizations introduce school payout splits.
- Learner dashboard routes stay `/dashboard/student` (not `/learner/*`).

# 00 — Product Overview and Non-Negotiables

**Req ID prefix:** OV

## What the product is

DriveLinkUp (drivelinkup.com) is a Nordic-first marketplace where driving schools and driving instructors list services and receive bookings. Live MVP status (audited October 22, 2026, public interface): Swedish national marketplace, categories AM–BE, discovery filters (category, city, price, rating, availability, school-vs-independent, English, geolocation, sorting, comparison), price transparency with cancellation tiers, 0% student fee / 10% commission after completion, request-form booking path, school-facing page, SEO surface. [OBSERVED-MVP]

## Actors

| Actor | Description | Default verification posture (spec 04) |
|---|---|---|
| Student (browser) | Anonymous discovery | None |
| Student (booker) | Verified contact, optional e-ID | Contact verification; eligibility per market rules |
| School representative | Onboards/managed a school profile | e-ID + company-register match + authority per signing mode |
| Instructor | Teaches at/for a school or independently | Identity + professional eligibility + school affiliation where required |
| Payout recipient | Receives money | Payment-provider onboarding (provider TBD) |
| Admin (DriveLinkUp staff) | Verification review, ops | Internal role, fully audited actions |

## The product thesis this iteration implements

> Reliable instant booking requires authoritative control of the offered resources — not merely a calendar feed or an API.

Control comes from three product modes, all first-class: (1) **transaction-capable vendor connection**; (2) **verified allocation** (a protected inventory slice the school controls); (3) **native adoption** (the School Booking Workspace). A supplementary tier: **generic calendar connections** (Google/Microsoft) which sync occupied intervals but never establish authoritative reservation. [PROPOSED — carries plan §1 verbatim]

## Non-negotiables (canonical — referenced, never restated, elsewhere)

| # | Rule | Spec |
|---|---|---|
| NN1 | Never-verified school cannot activate a bookable offering | 04 |
| NN2 | Identity ≠ permission; separate evidence, separate expiries | 02, 04 |
| NN3 | Not-found → review, never silent auto-rejection or silent permission | 04 |
| NN4 | Vendor outreach is not integration access; connectors ship disabled | 05 |
| NN5 | Calendar sync is not booking authority | 03, 05 |
| NN6 | Payment provider not assumed; commission logic provider-independent | 03 |
| NN7 | Claims shown must match stored evidence exactly (fixes B2) | 04, 06 |
| NN8 | All strings through i18n (fixes B5) | 06 |
| NN9 | No booking surface without explicit school authorization; directory listing ≠ booking consent; withdrawal is server-side and survives refresh | 02, 03, 06, 08 |
| NN10 | School's own cancellation policy displayed verbatim, versioned and snapshotted per booking; never a platform-invented default | 02, 03, 06 |

## Live-MVP defects to fix (from the October 22 audit — [OBSERVED-MVP])

| ID | Finding | Severity | Spec that fixes it |
|---|---|---|---|
| B1 | Instant booking hands off to an external checkout; reservation/confirmation/payment reconciliation through it unverified | High | 03 (capability flags), 05 (milestone 4) |
| B2 | Homepage claims "Behörighet — kontrollerad i förväg" while FAQ delegates responsibility to schools | High | 04 (claim alignment), 06 |
| B3 | Instructor signup criterion ("körkort 5 år") legally exposed in Sweden — paid instruction requires traffic-school permit + approved trafiklärare | Critical | 04 (R6c), 02 (instructor eligibility) |
| B4 | Third-party review content reproduced with unverified rights basis | Critical | 06 (remove or replace with transaction-verified reviews) |
| B5 | i18n raw keys rendered in booking form | Cosmetic | 06 |
| B6 | Availability display partial — some profiles show next free slot, others "Kontakta oss" | Medium | 03 (capability flags drive display) |

## Country scope honesty

Sweden is the deep-validation market. Nordics screened; Denmark/Finland lookup routes documented with unresolved status-disclosure gaps; Iceland minimal. European rows are research register entries, not launch commitments. US off-roadmap. Per-market launch gates are in spec 04 §6. [EXTERNAL — plan §3]

## Non-goals for this iteration

- No new markets launched (R10 comparison decides the next market).
- No whole-school accounting integration (earnings view is scoped to authoritative records DriveLinkUp ingests).
- No blanket documentary KYC for every student (exception-based step-up only, spec 04 §5).
- No TABS-Sweden adapter (product closes 31 Dec 2026; verified).

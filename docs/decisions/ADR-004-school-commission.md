# ADR-004: Driving school commission is 8%

## Status
Accepted

## Date
2026-09-27

## Context
DriveLinkUp connects learners with both independent instructors and driving schools. Independent instructors pay 10% commission (existing). Schools need a distinct commercial model that reflects their volume and gives them a reason to join the platform rather than operate independently.

## Decision
School-affiliated bookings pay the platform 8% commission on the lesson price. Independent instructor bookings stay at 10%. Learners pay 0%.

The 8% is taken from the total lesson price. The school receives 92% and pays its instructors according to its own arrangements. DriveLinkUp does not mediate the school↔instructor payout.

The 8% rate undercuts the 10% independent rate deliberately — it incentivizes instructors and schools to operate as organizations rather than as sole traders.

## Consequences
- Booking must record organizationId at booking time (slice 6).
- booking-fees.ts must branch on organizationId (slice 6).
- Stripe Connect onboarding needed for schools (slice 6).
- Until slice 6 ships, all bookings use the 10% model.
- 8% is near the low end for marketplace take rates. Revisit if platform costs (Stripe, KYC, support) exceed 8% of booking value.

## Alternatives Considered

### 10% for schools, same as instructors
- Pros: One rate to explain.
- Cons: No reason for schools to prefer the platform over hiring instructors directly.
- Rejected.

### 5% for schools
- Pros: Stronger recruiting discount.
- Cons: Too generous given 10% is the independent rate.
- Rejected.

### 15% for schools
- Pros: Higher platform take.
- Cons: Erodes already-thin school margins and blocks supply growth.
- Rejected.

### 15% on top of 10% (25% total)
- Pros: None that survive contact with school margins.
- Cons: Unrealistic.
- Rejected.

### Flat subscription only
- Pros: Predictable revenue later.
- Cons: Wrong model pre-traction.
- Rejected.

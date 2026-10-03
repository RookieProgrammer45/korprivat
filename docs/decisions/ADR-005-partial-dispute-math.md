# ADR-005: Partial dispute payout math

Status: Accepted  
Date: 2026-10-03

## Context

Admin dispute resolve currently returns 501 for `outcome=partial`. We need a
rule that does not invent a custom ledger (AGENTS.md: money stays on Stripe).

## Decision

On partial resolution:

1. Refund `refundSek` to the learner via Stripe Refund against the original charge.
2. Transfer `max(0, booking.payoutAmountSek - refundSek)` to the Connect destination.
3. Set `paymentStatus` to a terminal state (`released` if transfer > 0, else `refunded`).

Implemented helper: `partialPayoutAfterRefund` in `src/lib/trust/disputes.ts`.
Admin route enables `partial` once refund amount is accepted in the request body.

## Consequences

- Fee snapshots (`payoutAmountSek`) must exist before partial resolve.
- No school↔instructor sub-ledger; school bookings still pay the org Connect account.

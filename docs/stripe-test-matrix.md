# Stripe TEST-mode escrow matrix

Run with `sk_test_` keys before any live charges. Check each box only after
end-to-end proof (not mocked). Source: [docs/progress.md](progress.md).

| # | Case | Pass |
| --- | --- | --- |
| 1 | Instructor Connect onboarding (chargesEnabled + payoutsEnabled; no duplicate Express) | [ ] |
| 2 | Buyer happy path → `held_escrow` via webhook | [ ] |
| 3 | Deliver → confirm → transfer → `released` + PayoutRecord (90% / 92%) | [ ] |
| 4 | Auto-release cron with past `autoReleaseAt` | [ ] |
| 5 | Dispute → admin release; partial returns 501 (or ADR-enabled partial) | [ ] |
| 6 | Confirm + cron race → exactly one transfer | [ ] |
| 7 | Admin retry gates (held/awaiting → 409; payout_failed → 200) | [ ] |
| 8 | Cancel + refund → `refunded` | [ ] |

Webhook events that must be registered on `https://www.drivelinkup.com/api/webhooks/stripe`:

- `checkout.session.completed`
- `checkout.session.expired`
- `account.updated`
- `account.application.deauthorized`
- `charge.dispute.created`
- `charge.refunded`
- `transfer.failed`

Do not accept live payments until all 8 cases pass.

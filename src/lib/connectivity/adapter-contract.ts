import { z } from 'zod';

const resourceBundle = z.object({
  instructor_ref: z.string().min(1),
  vehicle_ref: z.string().min(1),
  location_ref: z.string().min(1),
});

export const HoldRequest = z.object({
  offering_ref: z.string().min(1),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  resource_bundle: resourceBundle,
  hold_ttl_seconds: z.number().int().positive(),
  idempotency_key: z.string().min(1),
});

export const HoldSuccess = z.object({
  status: z.literal('held'),
  hold_ref: z.string().min(1),
  hold_expires_at: z.string().min(1),
  vendor_reservation_ref: z.string().min(1),
});

export const AdapterConflict = z.object({
  error: z.object({
    code: z.literal('resource_conflict'),
    retryable: z.literal(false),
  }),
});

export const CommitRequest = z.object({
  hold_ref: z.string().min(1),
  idempotency_key: z.string().min(1),
});

export const CommitSuccess = z.object({
  status: z.literal('confirmed'),
  vendor_reservation_ref: z.string().min(1),
  confirmed_at: z.string().min(1),
});

export const ReleaseRequest = z.object({
  hold_ref: z.string().min(1),
  reason: z.enum(['expiry', 'cancel']),
  idempotency_key: z.string().min(1),
});

export const ReleaseSuccess = z.object({ status: z.literal('released') });

export const CancelRequest = z.object({
  vendor_reservation_ref: z.string().min(1),
  reason: z.string().min(1),
  idempotency_key: z.string().min(1),
});

export const CancelSuccess = z.object({
  status: z.literal('cancelled'),
  refund_route: z.literal('per_policy'),
});

export const RescheduleRequest = z.object({
  vendor_reservation_ref: z.string().min(1),
  new_offering_ref: z.string().min(1),
  new_starts_at: z.string().min(1),
  new_ends_at: z.string().min(1),
  new_resource_bundle: resourceBundle,
  hold_ttl_seconds: z.number().int().positive(),
  idempotency_key: z.string().min(1),
});

export const RescheduleSuccess = z.object({
  status: z.literal('rescheduled'),
  old: z.object({ status: z.literal('released') }),
  new: z.object({
    status: z.literal('confirmed'),
    vendor_reservation_ref: z.string().min(1),
    confirmed_at: z.string().min(1),
  }),
});

export const AuthoritativeState = z.object({
  status: z.enum(['held', 'confirmed', 'cancelled', 'expired', 'absent']),
  vendor_reservation_ref: z.string().min(1),
  occurred_at: z.string().min(1),
  revision: z.number().int(),
});

export const ResyncRequest = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(500),
});

export const ResyncResponse = z.object({
  snapshots: z.array(
    z.object({
      vendor_reservation_ref: z.string().min(1),
      status: z.string().min(1),
      occurred_at: z.string().min(1),
      revision: z.number().int(),
    }),
  ),
  next_cursor: z.string().nullable(),
});

export const InboundEvent = z.object({
  event_id: z.string().min(1),
  vendor_reservation_ref: z.string().min(1),
  type: z.enum(['confirmed', 'cancelled', 'rescheduled', 'expired', 'changed']),
  revision: z.number().int().optional(),
  occurred_at: z.string().datetime().optional(),
  payload: z.unknown().optional(),
});

export const AvailabilityPut = z.object({
  windows: z
    .array(
      z.object({
        offering_ref: z.string().min(1),
        starts_at: z.string().min(1),
        ends_at: z.string().min(1),
        resource_bundle: resourceBundle,
        price: z.object({
          amount_minor: z.number().int().nonnegative(),
          currency: z.string().min(1),
        }),
        idempotency_key: z.string().min(1),
      }),
    )
    .min(1),
  listing_id: z.string().min(1).optional(),
});

export const ContentPut = z.object({
  facts: z.record(z.string(), z.unknown()).optional(),
  offerings: z.array(z.record(z.string(), z.unknown())).optional(),
  policies: z.record(z.string(), z.unknown()).optional(),
  listing_id: z.string().min(1).optional(),
});

export function mockHold(input: {
  taken: boolean;
}):
  | { httpStatus: 200; body: z.infer<typeof HoldSuccess> }
  | { httpStatus: 409; body: z.infer<typeof AdapterConflict> } {
  if (input.taken) {
    return { httpStatus: 409, body: { error: { code: 'resource_conflict', retryable: false } } };
  }
  return {
    httpStatus: 200,
    body: HoldSuccess.parse({
      status: 'held',
      hold_ref: 'hold_x42',
      hold_expires_at: '2026-11-01T10:15:00Z',
      vendor_reservation_ref: 'T-55231',
    }),
  };
}

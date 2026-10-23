import { describe, expect, it } from 'vitest';
import {
  AuthoritativeState,
  AvailabilityPut,
  CommitRequest,
  CommitSuccess,
  HoldRequest,
  InboundEvent,
  mockHold,
  RescheduleSuccess,
  ResyncResponse,
} from '@/lib/connectivity/adapter-contract';
import { idempotencyDecision, productionEnablementDecision } from '@/lib/connectivity/policy';
import {
  canSignForEnvironment,
  signPartnerRequest,
  timestampWithinWindow,
} from '@/lib/connectivity/signing';

describe('connectivity contract', () => {
  it('parses the §7.2 hold, commit, reschedule, and state examples', () => {
    expect(
      HoldRequest.parse({
        offering_ref: 'off_b1_60min',
        starts_at: '2026-11-03T08:00:00+01:00',
        ends_at: '2026-11-03T09:00:00+01:00',
        resource_bundle: {
          instructor_ref: 'ins_anna',
          vehicle_ref: 'veh_124',
          location_ref: 'loc_main',
        },
        hold_ttl_seconds: 900,
        idempotency_key: 'res_a91_v1',
      }).idempotency_key,
    ).toBe('res_a91_v1');
    expect(
      CommitRequest.parse({ hold_ref: 'hold_x42', idempotency_key: 'commit_1' }).hold_ref,
    ).toBe('hold_x42');
    expect(
      CommitSuccess.parse({
        status: 'confirmed',
        vendor_reservation_ref: 'T-55231',
        confirmed_at: '2026-11-01T10:15:00Z',
      }).status,
    ).toBe('confirmed');
    expect(
      RescheduleSuccess.parse({
        status: 'rescheduled',
        old: { status: 'released' },
        new: {
          status: 'confirmed',
          vendor_reservation_ref: 'T-55232',
          confirmed_at: '2026-11-01T11:00:00Z',
        },
      }).new.status,
    ).toBe('confirmed');
    expect(
      AuthoritativeState.parse({
        status: 'absent',
        vendor_reservation_ref: 'T-55231',
        occurred_at: '2026-11-01T10:00:00Z',
        revision: 17,
      }).status,
    ).toBe('absent');
    expect(
      ResyncResponse.parse({
        snapshots: [
          {
            vendor_reservation_ref: 'T-55231',
            status: 'confirmed',
            occurred_at: '2026-11-01T10:00:00Z',
            revision: 17,
          },
        ],
        next_cursor: null,
      }).snapshots,
    ).toHaveLength(1);
    expect(
      InboundEvent.parse({
        event_id: 'evt_55',
        vendor_reservation_ref: 'T-55231',
        type: 'confirmed',
        revision: 18,
        occurred_at: '2026-11-01T10:00:00.000Z',
      }).event_id,
    ).toBe('evt_55');
    expect(AvailabilityPut.safeParse({ windows: [] }).success).toBe(false);
  });

  it('a mock hold conflict contains no partial reservation', () => {
    const conflict = mockHold({ taken: true });
    expect(conflict.httpStatus).toBe(409);
    expect(conflict.body).toEqual({ error: { code: 'resource_conflict', retryable: false } });
    expect(JSON.stringify(conflict.body)).not.toContain('hold_ref');
    const held = mockHold({ taken: false });
    expect(held.httpStatus).toBe(200);
    if (held.httpStatus === 200) expect(held.body.status).toBe('held');
  });

  it('SC-7 refuses production enablement from mock evidence', () => {
    expect(productionEnablementDecision('mock')).toMatchObject({
      httpStatus: 403,
      code: 'mock_evidence_refused',
      prodEnabled: false,
      recorded: false,
    });
    expect(productionEnablementDecision('vendor_environment').prodEnabled).toBe(false);
  });

  it('signs the method, path, timestamp, and body, and keeps environments apart', () => {
    const now = '2026-11-01T10:00:00.000Z';
    const signature = signPartnerRequest({
      secret: 'sandbox-secret',
      method: 'put',
      path: '/v1/connections/conn_a/availability',
      timestamp: now,
      body: '{}',
    });
    expect(signature).toHaveLength(64);
    expect(
      signPartnerRequest({
        secret: 'production-secret',
        method: 'PUT',
        path: '/v1/connections/conn_a/availability',
        timestamp: now,
        body: '{}',
      }),
    ).not.toBe(signature);
    expect(timestampWithinWindow(now, new Date(now))).toBe(true);
    expect(timestampWithinWindow(now, new Date('2026-11-01T10:06:00.000Z'))).toBe(false);
    expect(canSignForEnvironment('sandbox', 'production')).toBe(false);
    expect(idempotencyDecision({ existing: null, payloadHash: 'a' }).kind).toBe('new');
    expect(
      idempotencyDecision({
        existing: { payloadHash: 'a', responseStatus: 200, responseBody: { accepted: 1 } },
        payloadHash: 'b',
      }).kind,
    ).toBe('conflict');
  });
});

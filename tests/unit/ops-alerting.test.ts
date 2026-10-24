import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectorInstantBookingCertified } from '@/lib/certification/capability-policy';
import { evaluateAlert, LEADING_METRIC_IDS, THRESHOLD_METRIC_IDS } from '@/lib/ops/alerting-policy';

const {
  mockSession,
  mockSchools,
  mockConnectionCount,
  mockPartnerCount,
  mockCertCount,
  mockBookingCount,
  mockBookingFind,
  mockEventCount,
  mockOutboxCount,
  mockOutboxFind,
  mockOpsCount,
} = vi.hoisted(() => ({
  mockSession: vi.fn(),
  mockSchools: vi.fn(),
  mockConnectionCount: vi.fn(),
  mockPartnerCount: vi.fn(),
  mockCertCount: vi.fn(),
  mockBookingCount: vi.fn(),
  mockBookingFind: vi.fn(),
  mockEventCount: vi.fn(),
  mockOutboxCount: vi.fn(),
  mockOutboxFind: vi.fn(),
  mockOpsCount: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findMany: mockSchools },
    schoolConnection: { count: mockConnectionCount },
    partner: { count: mockPartnerCount },
    certification: { count: mockCertCount },
    booking: { count: mockBookingCount, findMany: mockBookingFind },
    bookingEvent: { count: mockEventCount },
    commandOutbox: { count: mockOutboxCount, findMany: mockOutboxFind },
    opsTask: { count: mockOpsCount },
  },
}));

import { GET as opsAlerts } from '@/app/api/admin/ops-alerts/route';

beforeEach(() => {
  delete process.env.OPS_ALERTING;
  delete process.env.OPS_ALERT_INBOX_DEPTH;
  delete process.env.OPS_ALERT_DEAD_LETTER_RATE;
  delete process.env.OPS_ALERT_QUARANTINE_AGE_SECONDS;
  delete process.env.OPS_ALERT_RECONCILIATION_DRIFT;
  mockSession.mockReset();
  mockSchools.mockReset();
  mockConnectionCount.mockReset();
  mockPartnerCount.mockReset();
  mockCertCount.mockReset();
  mockBookingCount.mockReset();
  mockBookingFind.mockReset();
  mockEventCount.mockReset();
  mockOutboxCount.mockReset();
  mockOutboxFind.mockReset();
  mockOpsCount.mockReset();
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
});

describe('ops alerting', () => {
  it('SC-8 still refuses booking from availability-only certification', () => {
    expect(connectorInstantBookingCertified({ availability_display: true })).toBe(false);
  });

  it('does not fire when the baseline is unmeasured', () => {
    expect(evaluateAlert({ value: 12, threshold: null })).toEqual({
      firing: false,
      baseline: 'unmeasured',
    });
    expect(evaluateAlert({ value: 3, threshold: 2 })).toEqual({
      firing: true,
      baseline: 'configured',
    });
  });

  it('hides the snapshot while the flag is off', async () => {
    const res = await opsAlerts();
    expect(res.status).toBe(404);
    expect(mockSchools).not.toHaveBeenCalled();
    expect(mockEventCount).not.toHaveBeenCalled();
  });

  it('lists every leading metric and fires only a configured inbox-depth threshold', async () => {
    process.env.OPS_ALERTING = '1';
    process.env.OPS_ALERT_INBOX_DEPTH = '2';
    mockSchools.mockResolvedValue([{ bookingMode: 'request' }, { bookingMode: 'contact' }]);
    mockConnectionCount.mockResolvedValue(0);
    mockPartnerCount.mockResolvedValue(1);
    mockCertCount.mockResolvedValue(0);
    mockBookingCount.mockResolvedValue(0);
    mockBookingFind.mockResolvedValue([]);
    mockEventCount.mockResolvedValue(3);
    mockOutboxCount.mockResolvedValue(0);
    mockOutboxFind.mockResolvedValue([]);
    mockOpsCount.mockResolvedValue(0);

    const res = await opsAlerts();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.map((metric: { id: string }) => metric.id)).toEqual([
      ...LEADING_METRIC_IDS,
    ]);
    expect(body.alerts.map((alert: { id: string }) => alert.id)).toEqual([...THRESHOLD_METRIC_IDS]);
    const inbox = body.alerts.find((alert: { id: string }) => alert.id === 'inbox_depth');
    expect(inbox).toMatchObject({ value: 3, threshold: 2, firing: true, baseline: 'configured' });
    const drift = body.alerts.find(
      (alert: { id: string }) => alert.id === 'reconciliation_drift_incidents',
    );
    expect(drift).toMatchObject({ firing: false, baseline: 'unmeasured' });
    delete process.env.OPS_ALERTING;
    delete process.env.OPS_ALERT_INBOX_DEPTH;
  });
});

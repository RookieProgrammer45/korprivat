import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConnectionFind, mockConnectionUpdate, mockEventCreate, mockEventUpdate } = vi.hoisted(
  () => ({
    mockConnectionFind: vi.fn(),
    mockConnectionUpdate: vi.fn(async () => ({})),
    mockEventCreate: vi.fn(),
    mockEventUpdate: vi.fn(async () => ({})),
  }),
);

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    schoolConnection: { findUnique: mockConnectionFind, update: mockConnectionUpdate },
    bookingEvent: { create: mockEventCreate, update: mockEventUpdate },
  },
}));

import { POST } from '@/app/api/inbox/events/route';

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/inbox/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const event = {
  connectionId: 'conn_1',
  providerEventId: 'evt_1',
  eventType: 'confirmed',
  revision: 8,
};

beforeEach(() => {
  delete process.env.RELIABLE_PROCESSING;
  mockConnectionFind.mockReset();
  mockConnectionUpdate.mockClear();
  mockEventCreate.mockReset();
  mockEventUpdate.mockClear();
});

afterEach(() => {
  delete process.env.RELIABLE_PROCESSING;
});

describe('POST /api/inbox/events', () => {
  it('stays dark while reliable processing is off', async () => {
    const res = await post(event);
    expect(res.status).toBe(404);
    expect(mockConnectionFind).not.toHaveBeenCalled();
  });

  it('SC-11 acknowledges a duplicate without moving the watermark', async () => {
    process.env.RELIABLE_PROCESSING = '1';
    mockConnectionFind.mockResolvedValue({
      id: 'conn_1',
      eventWatermarkRevision: 7,
      eventWatermarkAt: null,
    });
    mockEventCreate.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    const res = await post(event);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: 'rejected_duplicate' });
    expect(mockEventUpdate).not.toHaveBeenCalled();
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('SC-11 rejects a stale revision and does not apply it', async () => {
    process.env.RELIABLE_PROCESSING = '1';
    mockConnectionFind.mockResolvedValue({
      id: 'conn_1',
      eventWatermarkRevision: 9,
      eventWatermarkAt: null,
    });
    mockEventCreate.mockResolvedValueOnce({ id: 'be_1' });

    const res = await post(event);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: 'rejected_stale' });
    expect(mockEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { processingStatus: 'rejected_stale' } }),
    );
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('SC-11 asks for authoritative state when the revision is missing', async () => {
    process.env.RELIABLE_PROCESSING = '1';
    mockConnectionFind.mockResolvedValue({
      id: 'conn_1',
      eventWatermarkRevision: 9,
      eventWatermarkAt: null,
    });
    mockEventCreate.mockResolvedValueOnce({ id: 'be_2' });

    const res = await post({ ...event, revision: undefined });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: 'authoritative_retrieval_required' });
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('returns 429 when durable storage fails before the event is stored', async () => {
    process.env.RELIABLE_PROCESSING = '1';
    mockConnectionFind.mockResolvedValue({
      id: 'conn_1',
      eventWatermarkRevision: null,
      eventWatermarkAt: null,
    });
    mockEventCreate.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await post(event);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: { code: 'not_accepted' } });
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { authorizeCron } from '@/lib/payments/cron-auth';

describe('authorizeCron', () => {
  const prev = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it('accepts matching Bearer secret', () => {
    const req = new Request('http://localhost/api/cron/x', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    expect(authorizeCron(req)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const req = new Request('http://localhost/api/cron/x', {
      headers: { authorization: 'Bearer wrong' },
    });
    expect(authorizeCron(req)).toBe(false);
  });

  it('rejects missing secret env', () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost/api/cron/x', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    expect(authorizeCron(req)).toBe(false);
  });
});

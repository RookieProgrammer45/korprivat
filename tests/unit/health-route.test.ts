// @vitest-environment node
// Locks the health check contract: 200 + db:"ok" when the database answers,
// 503 + db:"error" when it does not (fail-closed for uptime monitors).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: vi.fn() } }));

import { GET } from '@/app/health/route';
import { prisma } from '@/lib/db';

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with db ok when SELECT 1 succeeds', async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ '?column?': 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'healthy', db: 'ok' });
  });

  it('returns 503 with db error when the database is unreachable', async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: 'unhealthy', db: 'error' });
  });
});

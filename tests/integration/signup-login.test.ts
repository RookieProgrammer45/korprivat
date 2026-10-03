//
// Asserts the auth-flank of the trust-critical flow. Three end-to-end paths:
//   1. POST /api/auth/welcome — single welcome email per account, deduped
//      via UserProfile.welcomeSentAt. Two POSTs produce ONE email; the
//      second returns 204 silently.
//   2. POST /api/auth/signup-redirect — session+role → dashboard path.
//      Idempotent: a second POST with a different role overwrites the row.
//   3. GET /api/bookings/me — anonymous 401, signed-in student receives
//      their bookings scoped to the authenticated user's scalar userId.
//
// biome: this file is OUTSIDE the overrides' `src/**` glob. Mock helpers
// are imported FIRST so their top-level vi.mock() calls are hoisted above
// the route-handler imports below.

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';
import { vi } from 'vitest';
import { prismaMock, resetPrisma } from './_setup/prisma-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  // require-auth.ts awaits headers() at module-init; without an active Next
  // request context, the real call throws. Return an empty Headers so the
  // helper flows past the await.
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as signupRedirectPOST } from '@/app/api/auth/signup-redirect/route';
import { POST as welcomePOST } from '@/app/api/auth/welcome/route';
import { GET as bookingsMeGET } from '@/app/api/bookings/me/route';
import { BookingList } from '@/lib/contracts/auth';
import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';
import { mockCallArg } from './_setup/mock-call';

const SESSION_USER = {
  id: 'user_alice',
  email: 'alice@example.test',
  name: 'Alice',
  role: 'user' as const,
};

const PROFILE_ROW_STUDENT = {
  userId: 'user_alice',
  role: 'STUDENT',
  welcomeSentAt: null,
};

const PROFILE_ROW_INSTRUCTOR = {
  userId: 'user_alice',
  role: 'INSTRUCTOR',
  welcomeSentAt: null,
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function bookingsReq(): Request {
  return new Request('http://localhost/api/bookings/me', { method: 'GET' });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
});

afterEach(() => {
  // Keep the mocks for the next case.
});

describe('POST /api/auth/welcome', () => {
  it('401 when no session', async () => {
    authMock.setUser(null);
    const res = await welcomePOST(
      jsonRequest('/api/auth/welcome', { email: 'alice@example.test' }),
    );
    expect(res.status).toBe(401);
    expect(prismaMock.userProfile.updateMany).not.toHaveBeenCalled();
  });

  it('400 when body email does not match session email', async () => {
    authMock.setUser(SESSION_USER);
    const res = await welcomePOST(
      jsonRequest('/api/auth/welcome', { email: 'mallory@example.test' }),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.userProfile.updateMany).not.toHaveBeenCalled();
  });

  it('400 when JSON body malformed', async () => {
    authMock.setUser(SESSION_USER);
    const res = await welcomePOST(
      new Request('http://localhost/api/auth/welcome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when email is missing from body', async () => {
    authMock.setUser(SESSION_USER);
    const res = await welcomePOST(jsonRequest('/api/auth/welcome', {}));
    expect(res.status).toBe(400);
  });

  it('flips welcomeSentAt + sends ONE welcome email on first call (204)', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce(PROFILE_ROW_STUDENT);

    const res = await welcomePOST(
      jsonRequest('/api/auth/welcome', { email: 'alice@example.test' }),
    );

    expect(res.status).toBe(204);
    expect(prismaMock.userProfile.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.userProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_alice', welcomeSentAt: null },
        data: { welcomeSentAt: expect.any(Date) as unknown as Date },
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(mockCallArg<{ to: string }>(sendEmailMock).to).toBe('alice@example.test');
    expect(mockCallArg<{ subject: string }>(sendEmailMock).subject).toMatch(/Welcome/);
  });

  it('second post is a 204 no-op (welcomeSentAt already set) — no second email', async () => {
    authMock.setUser(SESSION_USER);
    // Conditional updateMany matches zero rows when welcomeSentAt is set.
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await welcomePOST(
      jsonRequest('/api/auth/welcome', { email: 'alice@example.test' }),
    );
    expect(res.status).toBe(204);
    // The "no second email" guarantee: a zero-count updateMany short-circuits
    // before the welcome email send.
    expect(prismaMock.userProfile.findUnique).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/signup-redirect', () => {
  it('401 when no session', async () => {
    authMock.setUser(null);
    const res = await signupRedirectPOST(
      jsonRequest('/api/auth/signup-redirect', { role: 'STUDENT' }),
    );
    expect(res.status).toBe(401);
  });

  it('defaults to STUDENT when role is missing or unparseable', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.update.mockResolvedValueOnce(PROFILE_ROW_STUDENT);

    const res = await signupRedirectPOST(
      new Request('http://localhost/api/auth/signup-redirect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    const body = (await res.json()) as { to: string };
    expect(body.to).toBe('/dashboard/student');
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_alice' },
        data: { role: 'STUDENT' },
      }),
    );
  });

  it('writes INSTRUCTOR role and returns /dashboard/instructor', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.update.mockResolvedValueOnce(PROFILE_ROW_INSTRUCTOR);

    const res = await signupRedirectPOST(
      jsonRequest('/api/auth/signup-redirect', { role: 'INSTRUCTOR' }),
    );
    const body = (await res.json()) as { to: string };
    expect(body.to).toBe('/dashboard/instructor');
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'INSTRUCTOR' } }),
    );
  });

  it('second post overwrites the role (idempotent — second wins)', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.update
      .mockResolvedValueOnce(PROFILE_ROW_STUDENT)
      .mockResolvedValueOnce(PROFILE_ROW_INSTRUCTOR);

    const r1 = await signupRedirectPOST(
      jsonRequest('/api/auth/signup-redirect', { role: 'STUDENT' }),
    );
    expect(((await r1.json()) as { to: string }).to).toBe('/dashboard/student');

    const r2 = await signupRedirectPOST(
      jsonRequest('/api/auth/signup-redirect', { role: 'INSTRUCTOR' }),
    );
    expect(((await r2.json()) as { to: string }).to).toBe('/dashboard/instructor');

    expect(prismaMock.userProfile.update).toHaveBeenCalledTimes(2);
    expect(mockCallArg(prismaMock.userProfile.update, 1)).toMatchObject({
      data: { role: 'INSTRUCTOR' },
    });
  });
});

describe('GET /api/bookings/me', () => {
  it('401 when not signed in', async () => {
    authMock.setUser(null);
    const res = await bookingsMeGET(bookingsReq());
    expect(res.status).toBe(401);
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it('returns the userId-scoped list when signed in', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.booking.findMany.mockResolvedValueOnce([
      {
        id: 'booking_xyz',
        instructorId: 'instructor_erik',
        category: 'B',
        preferredAt: new Date('2026-08-10T14:30:00.000Z'),
        paymentStatus: 'unpaid',
      },
    ]);
    prismaMock.instructor.findMany.mockResolvedValueOnce([
      { id: 'instructor_erik', name: 'Erik Lindqvist' },
    ]);

    const res = await bookingsMeGET(bookingsReq());
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    const parsed = BookingList.parse(json);
    expect(parsed.items[0]).toMatchObject({
      id: 'booking_xyz',
      counterpartyName: 'Erik Lindqvist',
      category: 'B',
      paymentStatus: 'unpaid',
    });

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: SESSION_USER.id },
      }),
    );
  });

  it('defaults paymentStatus to "unpaid" when DB value is null', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.booking.findMany.mockResolvedValueOnce([
      {
        id: 'booking_nullpay',
        instructorId: 'instructor_erik',
        category: 'B',
        preferredAt: new Date('2026-08-10T14:30:00.000Z'),
        paymentStatus: null,
      },
    ]);
    prismaMock.instructor.findMany.mockResolvedValueOnce([{ id: 'instructor_erik', name: 'Erik' }]);
    const res = await bookingsMeGET(bookingsReq());
    const json = (await res.json()) as unknown;
    const parsed = BookingList.parse(json);
    expect(parsed.items[0]?.paymentStatus).toBe('unpaid');
  });

  it('returns empty list when signed-in user has no bookings yet', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.booking.findMany.mockResolvedValueOnce([]);
    prismaMock.instructor.findMany.mockResolvedValueOnce([]);
    const res = await bookingsMeGET(bookingsReq());
    const json = (await res.json()) as unknown;
    const parsed = BookingList.parse(json);
    expect(parsed.items).toHaveLength(0);
  });
});

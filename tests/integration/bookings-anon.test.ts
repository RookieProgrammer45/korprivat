//
// Coverage:
//   1. POST /api/bookings                      — no session → 401
//   2. POST /api/bookings                      — claimed DOB age 15 → 403
//                                                learner_not_eligible /
//                                                BLOCKED_UNDERAGE
//   3. POST /api/bookings                      — signed-in + DOB 16+ → 201,
//                                                emails sent, userId set
//   4. POST /api/bookings → category mismatch  — rejected 400, no email
//   5. POST /api/bookings → unknown instructor — rejected 400, no email
//   6. POST /api/bookings → instructor without email — still 201, only the
//                                                student email is sent
//   7. GET /api/bookings/[id]                  — booking detail returns
//                                                the persisted row + rate
//   8. Post-create dashboard read              — signed-in owner sees the
//                                                booking via /api/bookings/me

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';
import { vi } from 'vitest';
import { mockCallArg } from './_setup/mock-call';
import {
  bookingRow,
  instructorRow,
  prismaMock,
  resetPrisma,
  TEST_LEARNER_ACCESS_TOKEN,
} from './_setup/prisma-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as bookingDetailGET } from '@/app/api/bookings/[id]/route';
import { GET as bookingsMeGET } from '@/app/api/bookings/me/route';

import { POST as bookingsPOST } from '@/app/api/bookings/route';
import { BookingList } from '@/lib/contracts/auth';
import { BookingCreated } from '@/lib/contracts/bookings';
import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

const VALID_BODY = {
  studentName: 'Test Learner',
  studentEmail: 'learner@example.test',
  studentPhone: '+46700000000',
  category: 'B',
  slotId: 'slot_1',
  instructorId: 'instructor_erik',
};

const LEARNER_USER = {
  id: 'user_learner',
  email: 'learner@example.test',
  name: 'Test Learner',
  role: 'user' as const,
};

function dobYearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 15);
  d.setHours(12, 0, 0, 0);
  return d;
}

function jsonPost(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function bookingsMeReq(): Request {
  return new Request('http://localhost/api/bookings/me', { method: 'GET' });
}

function stubOpenSlot(slotId = 'slot_1'): void {
  prismaMock.availabilitySlot.findFirst.mockResolvedValueOnce({
    id: slotId,
    startsAt: new Date('2030-08-10T14:30:00.000Z'),
  });
}

function stubEligibleProfile(ageYears = 25): void {
  prismaMock.userProfile.findUnique.mockResolvedValueOnce({
    dateOfBirth: dobYearsAgo(ageYears),
    dateOfBirthVerified: dobYearsAgo(ageYears),
    verificationState: 'ACTIVE',
    diditAttempts: 1,
    diditLastDecision: 'approved',
    diditSessionId: 'didit_sess_test',
  });
}

function signInEligibleLearner(ageYears = 25): void {
  authMock.setUser(LEARNER_USER);
  stubEligibleProfile(ageYears);
}

function learnerReadReq(url: string, token = TEST_LEARNER_ACCESS_TOKEN): Request {
  return new Request(url, { headers: { Authorization: `Bearer ${token}` } });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
});

afterEach(() => {
  // nothing to restore
});

describe('POST /api/bookings — auth + verified ACTIVE gate', () => {
  it('returns 401 when there is no session', async () => {
    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(401);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('returns 403 learner_not_eligible when claimed DOB is age 15', async () => {
    authMock.setUser(LEARNER_USER);
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      dateOfBirth: dobYearsAgo(15),
      dateOfBirthVerified: null,
      verificationState: 'SIGNED_UP',
      diditAttempts: 0,
      diditLastDecision: null,
      diditSessionId: null,
    });

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'learner_not_eligible',
      state: 'BLOCKED_UNDERAGE',
      redirectTo: '/signup?blocked=underage',
    });
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('returns 403 when adult has claimed DOB only (not Didit-verified)', async () => {
    authMock.setUser(LEARNER_USER);
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      dateOfBirth: dobYearsAgo(25),
      dateOfBirthVerified: null,
      verificationState: 'SIGNED_UP',
      diditAttempts: 0,
      diditLastDecision: null,
      diditSessionId: null,
    });

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'learner_not_eligible',
      state: 'SIGNED_UP',
      redirectTo: '/onboarding/learner/verify',
    });
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  it('persists a row + sends BOTH emails when signed-in ACTIVE learner (201)', async () => {
    signInEligibleLearner(25);
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({
      id: 'booking_1',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(201);
    const json = (await res.json()) as unknown;
    const parsed = BookingCreated.parse(json);
    expect(parsed.id).toBe('booking_1');
    expect(parsed.hourlyRateSek).toBe(550);
    expect(parsed.learnerAccessToken).toEqual(expect.any(String));

    expect(prismaMock.booking.create).toHaveBeenCalledOnce();
    const createArgs = mockCallArg<{
      data: { studentEmail: string; category: string; userId: string };
    }>(prismaMock.booking.create);
    expect(createArgs.data.studentEmail).toBe('learner@example.test');
    expect(createArgs.data.userId).toBe('user_learner');
    expect(createArgs.data).toMatchObject({
      slotId: 'slot_1',
      priceAmountSek: 550,
      serviceFeeSek: 0,
      grossChargedSek: 550,
    });
    expect(createArgs.data).toHaveProperty('learnerAccessTokenHash');

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(mockCallArg<{ to: string }>(sendEmailMock).to).toBe('learner@example.test');
    expect(mockCallArg<{ to: string }>(sendEmailMock, 1).to).toBe('erik@drivelinkup.test');
  });

  it("400 + zero emails when category is not on the instructor's list", async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ categories: ['A2', 'BE'] }),
    );

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(400);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('400 + zero emails when instructor id is unknown', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(null);

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(400);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('201 + only student email when instructor has no email', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow({ email: null }));
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({
      id: 'booking_no_instr',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(mockCallArg<{ to: string }>(sendEmailMock).to).toBe('learner@example.test');
  });

  it('409 + no email when instant slot reservation loses the race', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({ id: 'booking_race' });
    prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));

    expect(res.status).toBe(409);
    expect(prismaMock.booking.create).toHaveBeenCalledOnce();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('409 + no row when request mode already has an active request for the slot', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ bookingMode: 'request' }),
    );
    stubOpenSlot();
    prismaMock.booking.findFirst.mockResolvedValueOnce({ id: 'existing_request' });

    const res = await bookingsPOST(jsonPost('/api/bookings', { ...VALID_BODY, mode: 'request' }));

    expect(res.status).toBe(409);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('400 on bad JSON', async () => {
    const res = await bookingsPOST(
      new Request('http://localhost/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      }),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.instructor.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('still returns 201 when instructor email fails to send', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({
      id: 'booking_partial',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });
    sendEmailMock
      .mockResolvedValueOnce({ id: 'student_ok' })
      .mockRejectedValueOnce(new Error('proxy 500'));

    const res = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/bookings/[id]', () => {
  it('returns the public detail envelope with hourlyRateSek attached', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({ id: 'booking_1', studentEmail: 'learner@example.test' }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow({ hourlyRateSek: 550 }));

    const res = await bookingDetailGET(learnerReadReq('http://localhost/api/bookings/booking_1'), {
      params: Promise.resolve({ id: 'booking_1' }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.id).toBe('booking_1');
    expect(json.hourlyRateSek).toBe(550);
    expect(json.paymentStatus).toBe('unpaid');
    expect(json.heldAt).toBeNull();
    expect(json).not.toHaveProperty('studentName');
    expect(json).not.toHaveProperty('studentEmail');
    expect(json).not.toHaveProperty('payoutAmountSek');
    expect(json).not.toHaveProperty('stripeCheckoutSessionId');
  });

  it('404 when booking row is missing', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);

    const res = await bookingDetailGET(new Request('http://localhost/api/bookings/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('404 when the linked instructor is gone (orphaned booking)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(bookingRow({ id: 'orphan' }));
    prismaMock.instructor.findUnique.mockResolvedValueOnce(null);

    const res = await bookingDetailGET(new Request('http://localhost/api/bookings/orphan'), {
      params: Promise.resolve({ id: 'orphan' }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects a booking id without the learner token', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(bookingRow({ id: 'private_booking' }));
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());

    const res = await bookingDetailGET(
      learnerReadReq('http://localhost/api/bookings/private_booking', 'wrong-token'),
      { params: Promise.resolve({ id: 'private_booking' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('post-create dashboard read (signed-in booking joins by user id)', () => {
  it('the signed-in owner sees the booking on /api/bookings/me', async () => {
    signInEligibleLearner();
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({
      id: 'booking_join',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });
    const create = await bookingsPOST(jsonPost('/api/bookings', VALID_BODY));
    expect(create.status).toBe(201);

    const createdBooking = mockCallArg<{
      data: { studentEmail: string; userId: string };
    }>(prismaMock.booking.create).data;
    expect(createdBooking.studentEmail).toBe('learner@example.test');
    expect(createdBooking.userId).toBe('user_learner');

    prismaMock.booking.findMany.mockResolvedValueOnce([
      {
        id: 'booking_join',
        instructorId: 'instructor_erik',
        category: 'B',
        preferredAt: new Date('2026-08-10T14:30:00.000Z'),
        paymentStatus: 'unpaid',
      },
    ]);
    prismaMock.instructor.findMany.mockResolvedValueOnce([
      { id: 'instructor_erik', name: 'Erik Lindqvist' },
    ]);

    const dashRes = await bookingsMeGET(bookingsMeReq());
    expect(dashRes.status).toBe(200);
    const parsed = BookingList.parse((await dashRes.json()) as unknown);
    expect(parsed.items[0]).toMatchObject({
      id: 'booking_join',
      counterpartyName: 'Erik Lindqvist',
      category: 'B',
      paymentStatus: 'unpaid',
    });
  });

  it('does not use the submitted email as the dashboard authorization key', async () => {
    authMock.setUser({
      id: 'user_x',
      email: 'learner@example.test',
      name: 'Test',
      role: 'user',
    });
    stubEligibleProfile(25);
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    stubOpenSlot();
    prismaMock.booking.create.mockResolvedValueOnce({
      id: 'booking_case',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });

    await bookingsPOST(
      jsonPost('/api/bookings', {
        ...VALID_BODY,
        studentEmail: 'Learner@Example.Test',
      }),
    );
    expect(prismaMock.booking.create).toHaveBeenCalledTimes(1);
    const createdBooking = mockCallArg<{
      data: { userId: string };
    }>(prismaMock.booking.create).data;
    expect(createdBooking.userId).toBe('user_x');

    prismaMock.booking.findMany.mockResolvedValueOnce([
      {
        id: 'booking_case',
        instructorId: 'instructor_erik',
        category: 'B',
        preferredAt: new Date('2026-08-10T14:30:00.000Z'),
        paymentStatus: 'unpaid',
      },
    ]);
    prismaMock.instructor.findMany.mockResolvedValueOnce([]);
    const res = await bookingsMeGET(bookingsMeReq());
    const parsed = BookingList.parse((await res.json()) as unknown);
    expect(parsed.items[0]?.id).toBe('booking_case');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock factories — these run BEFORE any module imports so that the
// `vi.mock('@/lib/db', ...)` / `vi.mock('server-only', ...)` calls below can
// resolve to them.
const {
  sendEmailMock,
  mockInstructorFindUnique,
  mockBookingFindFirst,
  mockBookingCreate,
  mockSlotFindFirst,
  mockSlotUpdateMany,
  mockUserProfileFindUnique,
  mockHandledareFindFirst,
  mockTransaction,
  mockGetSessionUser,
} = vi.hoisted(() => ({
  sendEmailMock: vi.fn(async () => ({ id: 'mock_email_id' })),
  mockInstructorFindUnique: vi.fn(),
  mockBookingFindFirst: vi.fn(),
  mockBookingCreate: vi.fn(),
  mockSlotFindFirst: vi.fn(),
  mockSlotUpdateMany: vi.fn(),
  mockUserProfileFindUnique: vi.fn(),
  mockHandledareFindFirst: vi.fn(async () => null),
  mockTransaction: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

const LEARNER_SESSION = {
  id: 'user_learner',
  email: 'learner@example.test',
  name: 'Test Learner',
};

function dobYearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 15);
  d.setHours(12, 0, 0, 0);
  return d;
}

// vi.mock calls are hoisted above all imports by Vitest.
vi.mock('@/lib/email/send', () => ({
  sendEmail: sendEmailMock,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findUnique: mockInstructorFindUnique },
    booking: { findFirst: mockBookingFindFirst, create: mockBookingCreate },
    availabilitySlot: { findFirst: mockSlotFindFirst, updateMany: mockSlotUpdateMany },
    userProfile: { findUnique: mockUserProfileFindUnique },
    handledareEnrollment: { findFirst: mockHandledareFindFirst },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/require-auth', () => ({
  getSessionUser: mockGetSessionUser,
  requireAuth: async () => {
    const user = await mockGetSessionUser();
    if (!user) {
      throw Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return user;
  },
}));

// `server-only` is a Next-time side-effect guard that throws on the client
// bundle. It isn't installed at the package root in this app's tree, and
// vitest runs without Next's resolver; emulate the package as a 1-line stub
// so the route handler's `import 'server-only'` line can be unit-tested.
vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/bookings/route';

const VALID_BODY = {
  studentName: 'Test Learner',
  studentEmail: 'learner@example.test',
  studentPhone: '+46700000000',
  category: 'B',
  slotId: 'slot_1',
  instructorId: 'instructor_erik',
};

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function instructorRecord(
  overrides: Partial<{
    id: string;
    name: string;
    city: string;
    categories: string[];
    hourlyRateSek: number;
    email: string | null;
    cancellationPolicyTier: string | null;
    bookingMode: 'instant' | 'request' | null;
  }> = {},
) {
  return {
    id: 'instructor_erik',
    name: 'Erik Lindqvist',
    city: 'Stockholm',
    categories: ['B', 'A2'],
    hourlyRateSek: 550,
    email: 'erik@drivelinkup.test',
    cancellationPolicyTier: 'flexible',
    bookingMode: 'instant',
    ...overrides,
  };
}

describe('POST /api/bookings — email dispatch', () => {
  beforeEach(() => {
    sendEmailMock.mockClear();
    sendEmailMock.mockResolvedValue({ id: 'mock_email_id' });
    mockInstructorFindUnique.mockReset();
    mockBookingFindFirst.mockReset();
    mockBookingCreate.mockReset();
    mockSlotFindFirst.mockReset();
    mockSlotUpdateMany.mockReset();
    mockUserProfileFindUnique.mockReset();
    mockTransaction.mockReset();
    mockGetSessionUser.mockReset();
    mockGetSessionUser.mockResolvedValue(LEARNER_SESSION);
    mockUserProfileFindUnique.mockResolvedValue({
      dateOfBirth: dobYearsAgo(25),
      dateOfBirthVerified: dobYearsAgo(25),
      verificationState: 'ACTIVE',
      diditAttempts: 1,
      diditLastDecision: 'approved',
      diditSessionId: 'didit_sess_unit',
    });
    mockBookingFindFirst.mockResolvedValue(null);
    mockBookingCreate.mockResolvedValue({
      id: 'mock_booking',
      preferredAt: new Date('2030-08-10T14:30:00.000Z'),
    });
    mockSlotFindFirst.mockResolvedValue({
      id: 'slot_1',
      startsAt: new Date('2030-08-10T14:30:00.000Z'),
      endsAt: new Date('2030-08-10T15:30:00.000Z'),
      durationMinutes: 60,
    });
    mockSlotUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation(async (callback: unknown) =>
      (callback as (tx: unknown) => Promise<unknown>)({
        booking: {
          findFirst: mockBookingFindFirst,
          create: mockBookingCreate,
        },
        availabilitySlot: {
          findFirst: mockSlotFindFirst,
          updateMany: mockSlotUpdateMany,
        },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT send email when zod parse fails (400)', async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, studentEmail: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(mockInstructorFindUnique).not.toHaveBeenCalled();
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('does NOT send email when the body is not JSON (400)', async () => {
    const res = await POST(
      new Request('http://localhost/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('does NOT send email when the instructor lookup misses (400)', async () => {
    mockInstructorFindUnique.mockResolvedValueOnce(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(mockInstructorFindUnique).toHaveBeenCalledOnce();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('does NOT send email when the category re-check fails (400)', async () => {
    mockInstructorFindUnique.mockResolvedValueOnce(instructorRecord({ categories: ['A2', 'BE'] }));
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('sends exactly two transactional emails on the happy path (201)', async () => {
    mockInstructorFindUnique.mockResolvedValueOnce(instructorRecord());
    mockBookingCreate.mockResolvedValueOnce({
      id: 'booking_abc123',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });

    const res = await POST(jsonRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    expect(sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'learner@example.test',
        subject: 'We received your booking request — DriveLinkUp',
      }),
    );
    const studentArgs = sendEmailMock.mock.calls[0] as unknown as Array<{ text: string }>;
    expect(studentArgs[0]?.text).toContain('Test Learner');
    expect(studentArgs[0]?.text).toContain('booking_abc123');
    expect(studentArgs[0]?.text).toContain('Erik Lindqvist');
    expect(studentArgs[0]?.text).toContain('B');

    expect(sendEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'erik@drivelinkup.test',
        subject: expect.stringMatching(/^New booking request — B on /),
      }),
    );
    const instructorArgs = sendEmailMock.mock.calls[1] as unknown as Array<{ text: string }>;
    expect(instructorArgs[0]?.text).toContain('Test Learner');
    expect(instructorArgs[0]?.text).toContain('learner@example.test');
    expect(instructorArgs[0]?.text).toContain('+46700000000');
    expect(instructorArgs[0]?.text).toContain('booking_abc123');
  });

  it('still returns 201 and sends the student email when the instructor has no email', async () => {
    mockInstructorFindUnique.mockResolvedValueOnce(instructorRecord({ email: null }));
    mockBookingCreate.mockResolvedValueOnce({
      id: 'booking_no_instr',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: 'learner@example.test' }),
    );
  });

  it('returns 201 even when sendEmail rejects for the instructor (student still sent)', async () => {
    mockInstructorFindUnique.mockResolvedValueOnce(instructorRecord());
    mockBookingCreate.mockResolvedValueOnce({
      id: 'booking_partial',
      preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    });
    sendEmailMock
      .mockResolvedValueOnce({ id: 'ok_student' })
      .mockRejectedValueOnce(new Error('proxy 500'));

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});

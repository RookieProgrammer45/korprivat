import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock factory — runs BEFORE `vi.mock('@/lib/db', ...)` so the
// reviewer.findMany call in the route can resolve to it.
const {
  mockReviewFindMany,
  mockInstructorFindUnique,
  mockBookingFindUnique,
  mockReviewFindFirst,
  mockReviewCreate,
  mockTransaction,
  mockRequireAuth,
} = vi.hoisted(() => ({
  mockReviewFindMany: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockBookingFindUnique: vi.fn(),
  mockReviewFindFirst: vi.fn(),
  mockReviewCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mockTransaction,
    review: {
      findMany: mockReviewFindMany,
      findFirst: mockReviewFindFirst,
      create: mockReviewCreate,
    },
    instructor: { findUnique: mockInstructorFindUnique },
    booking: { findUnique: mockBookingFindUnique },
  },
}));

vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));

// `server-only` is a Next-time side-effect guard that throws on the client
// bundle. It isn't installed at the package root in this app's tree, and
// vitest runs without Next's resolver; emulate the package as a 1-line stub
// so the route handler's `import 'server-only'` line can be unit-tested.
vi.mock('server-only', () => ({}));

import {
  GET as instructorReviewsGET,
  POST as instructorReviewsPOST,
} from '@/app/api/instructors/[id]/reviews/route';
import { GET } from '@/app/api/reviews/route';
import { ReviewList } from '@/lib/contracts/reviews';

function reviewRow(
  overrides: Partial<{
    id: string;
    instructorId: string;
    reviewerName: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }> = {},
) {
  return {
    id: 'review_abc',
    instructorId: 'instructor_erik',
    reviewerName: 'Lina',
    rating: 5,
    comment: 'Fantastisk lärare!',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('Review contract', () => {
  it('parses the empty list envelope', () => {
    const parsed = ReviewList.parse({ items: [] });
    expect(parsed.items).toEqual([]);
  });

  it('parses a valid list with boundary ratings 1 and 5', () => {
    const items = [
      {
        id: 'r1',
        instructorId: 'instructor_erik',
        reviewerName: 'A',
        rating: 1,
        comment: 'OK',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'r5',
        instructorId: 'instructor_erik',
        reviewerName: 'B',
        rating: 5,
        comment: 'Top',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    const parsed = ReviewList.parse({ items });
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects rating 0', () => {
    expect(() =>
      ReviewList.parse({
        items: [
          {
            id: 'r0',
            instructorId: 'instructor_erik',
            reviewerName: 'A',
            rating: 0,
            comment: 'x',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects rating 6', () => {
    expect(() =>
      ReviewList.parse({
        items: [
          {
            id: 'r6',
            instructorId: 'instructor_erik',
            reviewerName: 'A',
            rating: 6,
            comment: 'x',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects missing instructorId', () => {
    expect(() =>
      ReviewList.parse({
        items: [
          {
            id: 'r',
            reviewerName: 'A',
            rating: 4,
            comment: 'x',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects a non-integer rating', () => {
    expect(() =>
      ReviewList.parse({
        items: [
          {
            id: 'r',
            instructorId: 'instructor_erik',
            reviewerName: 'A',
            rating: 3.5,
            comment: 'x',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow();
  });
});

describe('GET /api/reviews', () => {
  beforeEach(() => {
    mockReviewFindMany.mockReset();
    mockInstructorFindUnique.mockReset();
    mockBookingFindUnique.mockReset();
    mockReviewFindFirst.mockReset();
    mockReviewCreate.mockReset();
    mockTransaction.mockReset();
    mockRequireAuth.mockReset();
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ review: { findFirst: mockReviewFindFirst, create: mockReviewCreate } }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with the empty schema when the table has no rows', async () => {
    mockReviewFindMany.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ items: [] });
    expect(mockReviewFindMany).toHaveBeenCalledOnce();
  });

  it('maps a DateTime row to an ISO string and returns 200', async () => {
    mockReviewFindMany.mockResolvedValueOnce([reviewRow()]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: 'review_abc',
      instructorId: 'instructor_erik',
      reviewerName: 'Lina',
      rating: 5,
      comment: 'Fantastisk lärare!',
      createdAt: '2026-07-15T10:00:00.000Z',
    });
  });

  it('orders the prisma call by createdAt desc', async () => {
    mockReviewFindMany.mockResolvedValueOnce([]);
    await GET();
    expect(mockReviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

function reviewRequest(body: unknown): Request {
  return new Request('http://localhost/api/instructors/instructor_erik/reviews', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function reviewContext() {
  return { params: Promise.resolve({ id: 'instructor_erik' }) };
}

function completedBooking(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user_learner',
    studentEmail: 'learner@example.test',
    instructorId: 'instructor_erik',
    completedAt: new Date('2026-08-01T10:00:00.000Z'),
    paymentStatus: 'released',
    cancellationOutcome: null,
    disputeStatus: null,
    ...overrides,
  };
}

describe('POST /api/instructors/[id]/reviews', () => {
  const body = {
    instructorId: 'instructor_erik',
    bookingId: 'booking_completed',
    reviewerName: 'Browser spoof',
    rating: 5,
    comment: 'Great lesson',
  };

  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      id: 'user_learner',
      email: 'learner@example.test',
      name: 'Verified Learner',
    });
    mockInstructorFindUnique.mockResolvedValue({ id: 'instructor_erik' });
    mockBookingFindUnique.mockResolvedValue(completedBooking());
    mockReviewFindFirst.mockResolvedValue(null);
    mockReviewCreate.mockResolvedValue({
      id: 'review_new',
      instructorId: 'instructor_erik',
      reviewerName: 'Verified Learner',
      rating: 5,
      comment: 'Great lesson',
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
    });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ review: { findFirst: mockReviewFindFirst, create: mockReviewCreate } }),
    );
  });

  it('returns 401 when the learner is not signed in', async () => {
    mockRequireAuth.mockRejectedValue(new Response(null, { status: 401 }));
    const response = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(response.status).toBe(401);
    expect(mockBookingFindUnique).not.toHaveBeenCalled();
  });

  it('returns 403 for a booking owned by another learner', async () => {
    mockBookingFindUnique.mockResolvedValue(
      completedBooking({ userId: 'another_user', studentEmail: 'other@example.test' }),
    );
    const response = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(response.status).toBe(403);
  });

  it('returns 409 when the lesson is not completed and released', async () => {
    mockBookingFindUnique.mockResolvedValue(
      completedBooking({ completedAt: null, paymentStatus: 'held_escrow' }),
    );
    const response = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(response.status).toBe(409);
  });

  it('returns 409 for a cancelled or disputed lesson', async () => {
    mockBookingFindUnique.mockResolvedValue(
      completedBooking({ cancellationOutcome: 'cancelled_late' }),
    );
    const cancelled = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(cancelled.status).toBe(409);

    mockBookingFindUnique.mockResolvedValue(completedBooking({ disputeStatus: 'open' }));
    const disputed = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(disputed.status).toBe(409);
  });

  it('returns 409 when the completed booking already has a review', async () => {
    mockReviewFindFirst.mockResolvedValue({ id: 'review_existing' });
    const response = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(response.status).toBe(409);
  });

  it('creates a review with the authenticated display name and hides bookingId publicly', async () => {
    const response = await instructorReviewsPOST(reviewRequest(body), reviewContext());
    expect(response.status).toBe(201);
    expect(mockReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking_completed',
          reviewerName: 'Verified Learner',
        }),
      }),
    );
    const json = await response.json();
    expect(json).not.toHaveProperty('bookingId');
  });
});

describe('GET /api/instructors/[id]/reviews eligibility', () => {
  beforeEach(() => {
    mockReviewFindMany.mockResolvedValue([]);
    mockRequireAuth.mockResolvedValue({
      id: 'user_learner',
      email: 'learner@example.test',
      name: 'Learner',
    });
    mockBookingFindUnique.mockResolvedValue(completedBooking());
    mockReviewFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ review: { findFirst: mockReviewFindFirst, create: mockReviewCreate } }),
    );
  });

  it('returns eligible only for the authenticated completed booking owner', async () => {
    const response = await instructorReviewsGET(
      new Request(
        'http://localhost/api/instructors/instructor_erik/reviews?bookingId=booking_completed',
      ),
      reviewContext(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).eligibility).toEqual({ status: 'eligible' });
  });
});

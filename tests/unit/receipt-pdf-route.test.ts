import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const instructorFindUnique = vi.fn();
  const bookingReceiptFindUnique = vi.fn();
  const requireAuth = vi.fn();
  const deliverBookingReceipt = vi.fn();
  const renderDocumentPdf = vi.fn(async (spec: unknown) =>
    new TextEncoder().encode(JSON.stringify(spec)),
  );
  return {
    bookingFindUnique,
    instructorFindUnique,
    bookingReceiptFindUnique,
    requireAuth,
    deliverBookingReceipt,
    renderDocumentPdf,
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: hoisted.bookingFindUnique },
    instructor: { findUnique: hoisted.instructorFindUnique },
    bookingReceipt: { findUnique: hoisted.bookingReceiptFindUnique },
  },
}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: hoisted.requireAuth }));
vi.mock('@/lib/pdf/client', () => ({ renderDocumentPdf: hoisted.renderDocumentPdf }));
vi.mock('@/lib/business/receipt-delivery', () => ({
  deliverBookingReceipt: hoisted.deliverBookingReceipt,
}));

import { POST as receiptPdfPOST } from '@/app/api/bookings/[id]/receipt/pdf/route';
import { POST as receiptResendPOST } from '@/app/api/bookings/[id]/receipt/resend/route';
import { GET as receiptGET } from '@/app/api/bookings/[id]/receipt/route';
import { hashLearnerAccessToken } from '@/lib/business/booking-access';

const booking = {
  id: 'booking_1',
  userId: 'learner_user',
  instructorId: 'instructor_1',
  learnerAccessTokenHash: hashLearnerAccessToken('learner-token'),
  actionToken: 'instructor-token',
  paymentStatus: 'paid',
};

const learnerReceipt = {
  receiptNumber: 'DLU-BOOKING_1-L',
  bookingId: 'booking_1',
  recipientRole: 'learner' as const,
  locale: 'en',
  learnerName: 'Canonical Learner',
  instructorName: 'Canonical Instructor',
  instructorCity: 'Stockholm',
  category: 'B',
  scheduledAt: new Date('2026-09-10T10:00:00.000Z'),
  durationMinutes: 90,
  priceAmountSek: 550,
  serviceFeeSek: 28,
  grossChargedSek: 578,
  commissionSek: 55,
  netPayoutSek: 495,
  verifiedAmountUsd: 61,
  paymentStatus: 'paid',
  payoutStatus: 'not_applicable',
  emailDeliveryStatus: null,
  issuedAt: new Date('2026-09-01T12:00:00.000Z'),
};

const instructorReceipt = {
  ...learnerReceipt,
  receiptNumber: 'DLU-BOOKING_1-I',
  recipientRole: 'instructor' as const,
  locale: 'sv',
  commissionSek: 55,
  netPayoutSek: 495,
  payoutStatus: 'released',
};

function request(url: string, body?: unknown): Request {
  return new Request(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
}

function routeContext() {
  return { params: Promise.resolve({ id: 'booking_1' }) };
}

beforeEach(() => {
  hoisted.bookingFindUnique.mockReset();
  hoisted.instructorFindUnique.mockReset();
  hoisted.bookingReceiptFindUnique.mockReset();
  hoisted.requireAuth.mockReset();
  hoisted.deliverBookingReceipt.mockReset();
  hoisted.renderDocumentPdf.mockReset();
  hoisted.renderDocumentPdf.mockImplementation(async (spec: unknown) =>
    new TextEncoder().encode(JSON.stringify(spec)),
  );
  hoisted.bookingFindUnique.mockResolvedValue(booking);
  hoisted.instructorFindUnique.mockResolvedValue({ userId: 'instructor_user' });
  hoisted.bookingReceiptFindUnique.mockImplementation(
    async (args: {
      where: { bookingId_recipientRole: { recipientRole: 'learner' | 'instructor' } };
    }) =>
      args.where.bookingId_recipientRole.recipientRole === 'learner'
        ? learnerReceipt
        : instructorReceipt,
  );
  hoisted.requireAuth.mockRejectedValue(new Response(null, { status: 401 }));
  hoisted.deliverBookingReceipt.mockResolvedValue({ status: 'sent', attempted: true });
});

describe('booking receipt PDF route', () => {
  it('rejects a nonparticipant before loading or rendering a receipt', async () => {
    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf'),
      routeContext(),
    );

    expect(response.status).toBe(401);
    expect(hoisted.bookingFindUnique).not.toHaveBeenCalled();
    expect(hoisted.bookingReceiptFindUnique).not.toHaveBeenCalled();
    expect(hoisted.renderDocumentPdf).not.toHaveBeenCalled();
  });

  it('renders the instructor receipt from its opaque email token', async () => {
    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf?token=instructor-token'),
      routeContext(),
    );
    const spec = hoisted.renderDocumentPdf.mock.calls[0]?.[0] as {
      title: string;
      totalCents: number;
    };

    expect(response.status).toBe(200);
    expect(spec).toMatchObject({
      title: 'DriveLinkUp bokningskvitto',
      totalCents: 49500,
    });
  });

  it('rejects a signed-in user from the other side of the booking', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'other_user' });

    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf'),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(hoisted.renderDocumentPdf).not.toHaveBeenCalled();
  });

  it('renders the canonical learner snapshot despite forged request fields', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });

    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf', {
        receiptNumber: 'FORGED',
        learnerName: 'Forged Learner',
        priceAmountSek: 1,
        grossChargedSek: 1,
        verifiedAmountUsd: 9999,
      }),
      routeContext(),
    );
    const spec = hoisted.renderDocumentPdf.mock.calls[0]?.[0] as {
      subtitle: string;
      lineItems: Array<{ unitAmountCents: number }>;
      totalCents: number;
      meta: Array<{ value: string }>;
      notes?: string;
    };

    expect(response.status).toBe(200);
    expect(spec).toMatchObject({
      subtitle: 'Canonical Instructor · B',
      lineItems: [{ unitAmountCents: 55000 }, { unitAmountCents: 2800 }],
      totalCents: 57800,
    });
    expect(spec.meta).toContainEqual({ label: 'Receipt number', value: 'DLU-BOOKING_1-L' });
    expect(spec.notes).toContain('61');
    expect(spec.notes).not.toContain('9999');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('DLU-BOOKING_1-L.pdf');
  });

  it('renders the instructor snapshot only for the authenticated instructor', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'instructor_user' });

    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf?token=instructor-token'),
      routeContext(),
    );
    const spec = hoisted.renderDocumentPdf.mock.calls[0]?.[0] as {
      title: string;
      lineItems: Array<{ description: string; unitAmountCents: number }>;
      totalCents: number;
      notes?: string;
    };

    expect(response.status).toBe(200);
    expect(spec).toMatchObject({
      title: 'DriveLinkUp bokningskvitto',
      lineItems: [
        { description: 'Elevens brutto betalda belopp (SEK)', unitAmountCents: 57800 },
        { description: 'DriveLinkUp-avgift (SEK)', unitAmountCents: -2800 },
        { description: 'Skolprovision (SEK)', unitAmountCents: -5500 },
      ],
      totalCents: 49500,
    });
    expect(spec.notes).toContain('Beloppen visas i SEK.');
  });

  it('keeps the authenticated learner on the learner receipt despite an instructor token', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });

    const response = await receiptGET(
      new Request('http://localhost/api/bookings/booking_1/receipt?token=instructor-token'),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ recipientRole: 'learner', receiptNumber: 'DLU-BOOKING_1-L' });
    expect(hoisted.bookingReceiptFindUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { bookingId_recipientRole: { bookingId: 'booking_1', recipientRole: 'learner' } },
      }),
    );
  });

  it('keeps the authenticated instructor on the instructor receipt despite a learner token', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'instructor_user' });

    const response = await receiptGET(
      new Request('http://localhost/api/bookings/booking_1/receipt?token=learner-token'),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ recipientRole: 'instructor', receiptNumber: 'DLU-BOOKING_1-I' });
  });

  it('renders the learner receipt from its opaque email token', async () => {
    const response = await receiptGET(
      new Request('http://localhost/api/bookings/booking_1/receipt?token=learner-token'),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ recipientRole: 'learner', receiptNumber: 'DLU-BOOKING_1-L' });
  });

  it('returns not found when the booking has no canonical receipt snapshot', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });
    hoisted.bookingReceiptFindUnique.mockResolvedValue(null);

    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf'),
      routeContext(),
    );

    expect(response.status).toBe(404);
    expect(hoisted.renderDocumentPdf).not.toHaveBeenCalled();
  });

  it('keeps the receipt JSON endpoint on the same authorization and snapshot lookup', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });

    const response = await receiptGET(
      new Request('http://localhost/api/bookings/booking_1/receipt'),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      receiptNumber: 'DLU-BOOKING_1-L',
      learnerName: 'Canonical Learner',
      lessonPriceSek: 550,
      serviceFeeSek: 28,
      totalPaidSek: 578,
    });
  });

  it('does not expose a receipt while the booking is unpaid', async () => {
    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });
    hoisted.bookingFindUnique.mockResolvedValue({ ...booking, paymentStatus: 'pending' });

    const response = await receiptPdfPOST(
      request('http://localhost/api/bookings/booking_1/receipt/pdf'),
      routeContext(),
    );

    expect(response.status).toBe(404);
    expect(hoisted.bookingReceiptFindUnique).not.toHaveBeenCalled();
    expect(hoisted.renderDocumentPdf).not.toHaveBeenCalled();
  });

  it('requires authentication or a valid receipt token before resend', async () => {
    const unauthenticated = await receiptResendPOST(
      request('http://localhost/api/bookings/booking_1/receipt/resend'),
      routeContext(),
    );
    expect(unauthenticated.status).toBe(401);
    expect(hoisted.deliverBookingReceipt).not.toHaveBeenCalled();

    hoisted.requireAuth.mockResolvedValue({ id: 'learner_user' });
    const learnerResponse = await receiptResendPOST(
      request('http://localhost/api/bookings/booking_1/receipt/resend?token=instructor-token'),
      routeContext(),
    );

    expect(learnerResponse.status).toBe(200);
    expect(hoisted.deliverBookingReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking_1', recipientRole: 'learner' }),
    );
    expect(hoisted.deliverBookingReceipt.mock.calls[0]?.[0]).not.toHaveProperty(
      'learnerAccessToken',
    );

    hoisted.requireAuth.mockRejectedValue(new Response(null, { status: 401 }));
    const tokenResponse = await receiptResendPOST(
      request('http://localhost/api/bookings/booking_1/receipt/resend?token=learner-token'),
      routeContext(),
    );

    expect(tokenResponse.status).toBe(200);
    expect(hoisted.deliverBookingReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({ bookingId: 'booking_1', recipientRole: 'learner' }),
    );
  });
});

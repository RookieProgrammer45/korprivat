import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
const translators = new Map<string, (key: string, values?: Record<string, unknown>) => string>();
vi.mock('@/lib/api-client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => {
    if (!translators.has(namespace))
      translators.set(
        namespace,
        (key, values) => `${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
      );
    return translators.get(namespace);
  },
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/custom/messaging/booking-messaging-entry', () => ({
  BookingMessagingEntry: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BookingCancelForm } from '@/components/custom/booking-cancel-form';
import { BookingPaymentLink } from '@/components/custom/booking-confirm-payment';
import { BookingPriceSummary } from '@/components/custom/booking-price-summary';

let container: HTMLDivElement;
let root: Root;
const booking = {
  id: 'booking_1',
  instructorId: 'provider',
  providerName: 'Provider',
  providerCity: 'Stockholm',
  category: 'B',
  paymentStatus: 'pending',
  scheduledAt: '2030-01-01T10:00:00Z',
  preferredAt: '2030-01-01T10:00:00Z',
  durationMinutes: 60,
  priceAmountSek: 550,
  serviceFeeSek: 0,
  grossChargedSek: 550,
  cancellationPolicyTier: 'moderate',
  cancellationTerms: null,
  cancellationOutcome: null,
};

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent === label,
  );
  expect(button).toBeDefined();
  act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function quote(amount: number) {
  return { priceAmountSek: amount, serviceFeeSek: 0, grossChargedSek: amount };
}

describe('booking Retry controls execute new requests', () => {
  it('reloads the failed quote with the same selected slot when Retry is clicked', async () => {
    mocks.apiFetch
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce(quote(550));
    await act(async () =>
      root.render(<BookingPriceSummary instructorId="provider" slotId="slot_1" />),
    );
    expect(container.textContent).toContain('error');
    clickButton('retry');
    await act(async () => {});
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch.mock.calls[1]?.[0]).toBe(
      '/api/booking-fees/quote?instructorId=provider&slotId=slot_1',
    );
    expect(container.textContent).toContain('550 SEK');
    expect(container.textContent).not.toContain('retry');
  });

  it('does not replace a new selected-slot quote with an old late response', async () => {
    let resolveOld: ((value: ReturnType<typeof quote>) => void) | undefined;
    mocks.apiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    mocks.apiFetch.mockResolvedValueOnce(quote(800));
    await act(async () =>
      root.render(<BookingPriceSummary instructorId="provider" slotId="old_slot" />),
    );
    await act(async () =>
      root.render(<BookingPriceSummary instructorId="provider" slotId="new_slot" />),
    );
    await act(async () => resolveOld?.(quote(550)));
    expect(container.textContent).toContain('800 SEK');
    expect(container.textContent).not.toContain('550 SEK');
  });

  it('starts a fresh polling sequence after the unchanged pending booking timed out', async () => {
    vi.useFakeTimers();
    mocks.apiFetch.mockImplementation(async (url: string) =>
      url.endsWith('/payment-poll')
        ? { verified: false, paymentStatus: 'pending', receiptEmailStatus: null }
        : booking,
    );
    await act(async () =>
      root.render(<BookingPaymentLink bookingId="booking_1" token="learner-token" />),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500 * 10);
    });
    const pollCalls = () =>
      mocks.apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/payment-poll'));
    expect(pollCalls()).toHaveLength(10);
    expect(container.textContent).toContain('paymentPollTimeoutTitle');
    clickButton('retryPaymentPoll');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(pollCalls()).toHaveLength(11);
    expect(container.textContent).not.toContain('paymentPollTimeoutTitle');
  });

  it('does not preview a fee for an unpaid request with a frozen future charge', async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mocks.apiFetch.mockResolvedValueOnce({
      ...booking,
      preferredAt: soon,
      scheduledAt: soon,
      paymentStatus: 'awaiting_approval',
    });
    await act(async () =>
      root.render(<BookingCancelForm bookingId="booking_1" token="learner-token" />),
    );
    expect(container.textContent).toContain('fee.none');
    expect(container.textContent).not.toContain('notCancellable');
    expect(container.textContent).not.toContain('fee.amount');
  });
});

describe('recorded cancellation follow-up', () => {
  it('keeps cancellation visible after a refresh outage and offers a real retry of pending reconciliation', async () => {
    const cancelled = {
      ...booking,
      paymentStatus: 'cancelled_partial',
      cancellationOutcome: 'cancelled_partial',
    };
    const response = {
      id: 'booking_1',
      paymentStatus: 'cancelled_partial',
      cancellationOutcome: 'cancelled_partial',
      cancelledAt: new Date().toISOString(),
      feeAmountSek: 0,
    };
    mocks.apiFetch
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce({ ...response, reconciliationPending: true })
      .mockRejectedValueOnce(new Error('refresh interrupted'))
      .mockResolvedValueOnce({ ...response, reconciliationPending: false })
      .mockResolvedValueOnce(cancelled);
    await act(async () => root.render(<BookingCancelForm bookingId="booking_1" />));
    clickButton('receipt.checkCancellation');
    await act(async () => {});
    expect(container.textContent).toContain('receipt.reconciliationPending');
    expect(container.textContent).toContain('receipt.withoutFee');
    expect(container.textContent).not.toContain('errorTitle');
    expect(JSON.parse(mocks.apiFetch.mock.calls[1]?.[1].body)).not.toHaveProperty('token');
    clickButton('receipt.checkCancellation');
    await act(async () => {});
    expect(
      mocks.apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/cancel')),
    ).toHaveLength(2);
    expect(container.textContent).not.toContain('receipt.reconciliationPending');
  });
});

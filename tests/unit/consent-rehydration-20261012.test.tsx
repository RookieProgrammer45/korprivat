import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentBanner } from '@/components/custom/consent-banner';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock('@/lib/api-client', () => ({ apiFetch: apiFetchMock }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const messages = {
  consentBanner: {
    intro: 'We use cookies.',
    privacy: 'Privacy',
    rejectNonEssential: 'Reject',
    customize: 'Customize',
    acceptAll: 'Accept',
    essentialLabel: 'Essential',
    essentialBody: 'Always on',
    analyticsLabel: 'Analytics',
    analyticsBody: 'Optional',
    marketingLabel: 'Marketing',
    marketingBody: 'Optional',
    save: 'Save',
    error: 'Could not save',
  },
};

let container: HTMLDivElement;
let root: Root;

async function renderBanner() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ConsentBanner />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
}

function serverConsent(policyVersion = PRIVACY_POLICY_VERSION) {
  return {
    policyVersion,
    scope: { essential: true as const, analytics: false, marketing: false },
    source: 'banner' as const,
    subjectId: 'subject-123',
    acceptedAt: '2026-10-12T00:00:00.000Z',
  };
}

describe('consent rehydration — 2026-10-12', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  it('uses a current localStorage decision without a network request', async () => {
    window.localStorage.setItem(
      'consent_v1',
      JSON.stringify({
        policyVersion: PRIVACY_POLICY_VERSION,
        scope: { essential: true, analytics: true, marketing: false },
      }),
    );

    await renderBanner();

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('rehydrates a current HTTP-only cookie decision when localStorage is empty', async () => {
    apiFetchMock.mockResolvedValue(serverConsent());

    await renderBanner();

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/consent',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each([
    ['stale server policy', () => apiFetchMock.mockResolvedValue(serverConsent('v2025.01.0'))],
    ['missing server cookie', () => apiFetchMock.mockResolvedValue(null)],
    ['rehydration failure', () => apiFetchMock.mockRejectedValue(new Error('offline'))],
  ])('keeps the banner available for %s', async (_case, arrange) => {
    arrange();

    await renderBanner();

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

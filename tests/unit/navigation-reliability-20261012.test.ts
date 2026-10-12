import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contactPayloadWithLocale } from '@/components/custom/contact-flow';
import type { ContactInquiryCreate } from '@/lib/contact/schema';
import { navItems } from '@/lib/nav';
import {
  documentLocaleAttributes,
  globalErrorFallback,
  normalizePublicLocale,
  publicLocaleFromCookie,
} from '@/lib/public-locale';

function loadMessages(locale: 'en' | 'sv') {
  return JSON.parse(readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8')) as {
    publicRecovery: {
      globalError: { title: string; description: string; action: string };
      notFound: { title: string; description: string; action: string };
      routeError: { title: string; description: string; action: string };
    };
  };
}

const contactValues: ContactInquiryCreate = {
  name: 'Alex Morgan',
  email: 'alex@example.com',
  message: 'Please help with my booking.',
  topic: 'booking_issue',
  locale: 'sv',
};

describe('public navigation reliability — 2026-10-12', () => {
  it('derives safe document attributes from the active locale and falls back for invalid input', () => {
    expect(documentLocaleAttributes('sv')).toEqual({ lang: 'sv', dir: 'ltr' });
    expect(documentLocaleAttributes('en')).toEqual({ lang: 'en', dir: 'ltr' });
    expect(documentLocaleAttributes('de')).toEqual({ lang: 'sv', dir: 'ltr' });
    expect(normalizePublicLocale(null)).toBe('sv');
  });

  it('uses only a valid browser locale cookie for the provider-less global error boundary', () => {
    expect(publicLocaleFromCookie('theme=dark; NEXT_LOCALE=en')).toBe('en');
    expect(publicLocaleFromCookie('NEXT_LOCALE=sv')).toBe('sv');
    expect(publicLocaleFromCookie('NEXT_LOCALE=de')).toBe('sv');
    expect(publicLocaleFromCookie('NEXT_LOCALE=%E0%A4%A')).toBe('sv');
    expect(publicLocaleFromCookie(null)).toBe('sv');
  });

  it('keeps minimal global-error fallback copy synchronized with paired messages', () => {
    expect(globalErrorFallback.sv).toEqual(loadMessages('sv').publicRecovery.globalError);
    expect(globalErrorFallback.en).toEqual(loadMessages('en').publicRecovery.globalError);
    expect(loadMessages('sv').publicRecovery).toHaveProperty('notFound');
    expect(loadMessages('en').publicRecovery).toHaveProperty('routeError');
  });

  it('removes the student-only payment method URL from generic footer data while preserving its route', () => {
    expect(navItems.some((item) => item.href === '/dashboard/student/payment-methods')).toBe(false);
    expect(
      existsSync(
        resolve(process.cwd(), 'src/app/(dashboard)/dashboard/student/payment-methods/page.tsx'),
      ),
    ).toBe(true);
  });

  it('submits the current supported UI locale without changing completed contact fields', () => {
    expect(contactPayloadWithLocale(contactValues, 'en')).toEqual({
      ...contactValues,
      locale: 'en',
    });
    expect(contactPayloadWithLocale({ ...contactValues, locale: 'en' }, 'sv')).toEqual(
      contactValues,
    );
    expect(contactPayloadWithLocale(contactValues, 'not-a-locale')).toEqual(contactValues);
  });
});

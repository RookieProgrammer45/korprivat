// <html>/<body> with inline styles (theme/providers unavailable). This file sits
// outside the i18n <I18nProvider/> because the layout it replaces is the one
// that would have wrapped next-intl's context. It uses only the browser-visible,
// validated locale cookie with Swedish as its server-safe fallback.

'use client';

import { useSyncExternalStore } from 'react';
import { defaultLocale } from '@/i18n/config';
import {
  documentLocaleAttributes,
  globalErrorFallback,
  publicLocaleFromCookie,
} from '@/lib/public-locale';

const subscribeToNothing = () => () => undefined;

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(
    subscribeToNothing,
    () => publicLocaleFromCookie(document.cookie),
    () => defaultLocale,
  );
  const { lang, dir } = documentLocaleAttributes(locale);
  const text = globalErrorFallback[locale];

  return (
    <html lang={lang} dir={dir}>
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{text.title}</h1>
        <p style={{ color: '#666' }}>{text.description}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '2px',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          {text.action}
        </button>
      </body>
    </html>
  );
}

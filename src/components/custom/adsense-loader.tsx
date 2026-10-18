// Google AdSense loader, mounted once in GlobalMounts.
//
// GDPR-safe: the loader script is injected ONLY after the visitor has granted
// "marketing" consent (localStorage consent_v1, written by ConsentBanner —
// which dispatches a `dl:consent` event when a decision is recorded).
//
// CSP-safe: the script element carries the per-request nonce exposed via
// <meta name="csp-nonce"> (HeadContent); script-src 'strict-dynamic' then
// admits the child scripts AdSense injects itself. No-ops entirely when
// NEXT_PUBLIC_ADSENSE_CLIENT is unset or malformed (fail closed).

'use client';

import { useEffect } from 'react';

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

type StoredConsent = {
  policyVersion: string;
  scope: { essential: boolean; analytics: boolean; marketing: boolean };
};

function marketingConsented(): boolean {
  try {
    const raw = window.localStorage.getItem('consent_v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredConsent | null;
    return parsed?.scope?.marketing === true;
  } catch {
    return false;
  }
}

export function AdSenseLoader() {
  useEffect(() => {
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
    if (!/^ca-pub-\d+$/.test(client)) return;

    let injected = false;

    const inject = () => {
      if (injected || !marketingConsented()) return;
      injected = true;
      if (document.querySelector('script[src*="adsbygoogle.js"]')) return;

      const nonce =
        document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined;
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(client)}`;
      if (nonce) script.setAttribute('nonce', nonce);
      document.head.appendChild(script);
    };

    inject();
    // Consent recorded after mount (first-visit banner click).
    window.addEventListener('dl:consent', inject);
    return () => window.removeEventListener('dl:consent', inject);
  }, []);

  return null;
}

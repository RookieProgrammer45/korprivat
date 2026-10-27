'use client';

// Loads the AdSense script only after marketing consent. The root layout
// must not inject pagead2 for every visitor — that would ignore the banner.

import { useEffect, useRef } from 'react';
import { adsenseAllowedByConsent, adsenseClient, adsenseScriptSrc } from '@/lib/adsense';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

const STORAGE_KEY = 'consent_v1';

function readMarketingGranted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      policyVersion?: string;
      scope?: { marketing?: boolean };
    };
    if (parsed.policyVersion !== PRIVACY_POLICY_VERSION) return false;
    return adsenseAllowedByConsent(parsed.scope);
  } catch {
    return false;
  }
}

function injectAdsenseScript(): void {
  if (document.querySelector('script[data-dl-adsense="1"]')) return;
  const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined;
  const script = document.createElement('script');
  script.async = true;
  script.src = adsenseScriptSrc(adsenseClient());
  script.crossOrigin = 'anonymous';
  script.dataset.dlAdsense = '1';
  if (nonce) script.nonce = nonce;
  document.head.appendChild(script);
}

export function AdsenseMount() {
  const loaded = useRef(false);

  useEffect(() => {
    const loadIfGranted = () => {
      if (loaded.current || !readMarketingGranted()) return;
      injectAdsenseScript();
      loaded.current = true;
    };

    loadIfGranted();
    const onConsent = (event: Event) => {
      const scope = (event as CustomEvent<{ marketing?: boolean }>).detail;
      if (adsenseAllowedByConsent(scope)) loadIfGranted();
    };
    window.addEventListener('dl:consent', onConsent);
    return () => window.removeEventListener('dl:consent', onConsent);
  }, []);

  return null;
}

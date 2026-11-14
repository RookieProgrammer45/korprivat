'use client';

import { useEffect } from 'react';
import { adsenseScriptSrc, adsenseShouldLoad } from '@/lib/adsense';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

const STORAGE_KEY = 'consent_v1';

function storedConsent(): { policyVersion?: string; scope?: { marketing?: boolean } } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { policyVersion?: string; scope?: { marketing?: boolean } };
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function loadAdsense(): void {
  if (document.getElementById('adsense-loader')) return;
  if (!adsenseShouldLoad(storedConsent(), PRIVACY_POLICY_VERSION)) return;
  const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? '';
  const script = document.createElement('script');
  script.id = 'adsense-loader';
  script.async = true;
  script.src = adsenseScriptSrc();
  script.crossOrigin = 'anonymous';
  if (nonce) {
    script.nonce = nonce;
    script.setAttribute('nonce', nonce);
  }
  document.head.appendChild(script);
}

/** Inserts AdSense only after the visitor has accepted marketing cookies. */
export function AdsenseLoader() {
  useEffect(() => {
    loadAdsense();
    const onConsent = () => loadAdsense();
    window.addEventListener('dl:consent', onConsent);
    return () => window.removeEventListener('dl:consent', onConsent);
  }, []);
  return null;
}

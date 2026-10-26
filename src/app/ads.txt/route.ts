// Google AdSense ads.txt. Uses NEXT_PUBLIC_ADSENSE_CLIENT when valid, otherwise
// the live publisher id in src/lib/adsense.ts.

import { adsenseClient, isAdsenseClient } from '@/lib/adsense';

const AUTH_FINGERPRINT = 'f08c47fec0942fa0'; // Google's owner-network fingerprint

export function GET(): Response {
  const client = adsenseClient();
  if (!isAdsenseClient(client)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(`google.com, ${client}, DIRECT, ${AUTH_FINGERPRINT}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

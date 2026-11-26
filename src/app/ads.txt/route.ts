// Google AdSense ads.txt. Uses NEXT_PUBLIC_ADSENSE_CLIENT when valid, otherwise
// the live publisher id in src/lib/adsense.ts.

import { adsenseAdsTxtLine, adsenseClient, isAdsenseClient } from '@/lib/adsense';

export function GET(): Response {
  const client = adsenseClient();
  if (!isAdsenseClient(client)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(adsenseAdsTxtLine(client), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

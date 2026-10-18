// Google AdSense ads.txt. Live only when NEXT_PUBLIC_ADSENSE_CLIENT is set —
// 404s (fail closed) otherwise, so the route never advertises a stale pub ID.

const AUTH_FINGERPRINT = 'f08c47fec0942fa0'; // Google's owner-network fingerprint

export function GET(): Response {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
  if (!/^ca-pub-\d+$/.test(client)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(`google.com, ${client}, DIRECT, ${AUTH_FINGERPRINT}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

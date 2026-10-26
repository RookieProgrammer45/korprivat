/** Public AdSense publisher id. Override with NEXT_PUBLIC_ADSENSE_CLIENT. */
export const ADSENSE_CLIENT_DEFAULT = 'ca-pub-7844902305148063';

const CLIENT_RE = /^ca-pub-\d+$/;

export function adsenseClient(
  envClient: string | undefined = process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
): string {
  const fromEnv = envClient?.trim() ?? '';
  return CLIENT_RE.test(fromEnv) ? fromEnv : ADSENSE_CLIENT_DEFAULT;
}

export function isAdsenseClient(value: string): boolean {
  return CLIENT_RE.test(value);
}

export function adsenseScriptSrc(client = adsenseClient()): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
}

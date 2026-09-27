// Add <meta>/<link> here (verification, preconnect) — React hoists them. For scripts use
// next/script with the passed `nonce` (CSP-safe). Edit freely.

export function HeadContent({ nonce }: { nonce?: string }) {
  void nonce;
  return <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" sizes="180x180" />;
}

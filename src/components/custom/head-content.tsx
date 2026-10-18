// Add <meta>/<link> here (verification, preconnect) — React hoists them. For scripts use
// next/script with the passed `nonce` (CSP-safe). Edit freely.
// The nonce is re-exposed as <meta name="csp-nonce"> so consent-gated client
// loaders (AdSenseLoader) can stamp CSP-allowed script tags after hydration.
// Same-origin only: a payload without script execution cannot read the meta
// and script-src has no 'unsafe-inline', so this does not weaken the rampart.

export function HeadContent({ nonce }: { nonce?: string }) {
  return (
    <>
      <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" sizes="180x180" />
      {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
    </>
  );
}

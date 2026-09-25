// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'DriveLinkUp';
export const siteDescription =
  'Compare authorized driving schools in Sweden and book the right lesson with no separate DriveLinkUp fee.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#18D8CC',
  /** PWA splash + install background. */
  backgroundColor: '#031515',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#031515',
    foreground: '#F1FAF9',
    /** Second line under the site name; '' hides it. */
    tagline: 'Compare schools. Book with clarity. Learn with confidence.',
  },
} as const;

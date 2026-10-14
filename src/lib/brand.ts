// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'DriveLinkUp';
export const siteDescription =
  'The marketplace that connects driving schools and certified instructors to learners in Sweden — compare, book, and learn with no separate DriveLinkUp fee.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — WHITE so overscroll/browser chrome never goes green. */
  themeColor: '#ffffff',
  /** PWA splash + install background — WHITE to match the page. */
  backgroundColor: '#ffffff',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#031515',
    foreground: '#F1FAF9',
    /** Second line under the site name; '' hides it. */
    tagline: 'Schools and certified instructors. Learners. One marketplace.',
  },
} as const;

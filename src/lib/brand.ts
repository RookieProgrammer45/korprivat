// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'DriveLinkUp';
export const siteDescription =
  'Jämför trafikskolor i katalogen. DriveLinkUp är en marknadsplats, inte en trafikskola. Priset syns på annonsen. Kostnadsfritt för elever.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — WHITE so overscroll/browser chrome never goes green. */
  themeColor: '#ffffff',
  /** PWA splash + install background — WHITE to match the page. */
  backgroundColor: '#ffffff',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#F1FAF9',
    foreground: '#0D1312',
    /** Second line under the site name; '' hides it. */
    tagline: 'En marknadsplats för trafikskolor — inte en myndighet.',
  },
} as const;

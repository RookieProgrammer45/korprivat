// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'DriveLinkUp';
/** Swedish homepage `<title>`. Keyword first, under 60 characters, no brand suffix. */
export const siteTitleSv = 'Jämför reservdelar, bilpriser och trafikskolor';
/** Default meta description. Must stay a free catalogue (see security-and-seo). */
export const siteDescription =
  'Jämför reservdelar, bilpriser och trafikskolor. Priset är det som publicerats. Gratis katalog för alla.';

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
    tagline: 'Katalog för trafikskolor i Sverige — inte en myndighet.',
  },
} as const;

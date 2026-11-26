import { Syne } from 'next/font/google';

export const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
});

/** Same loaded face as titles — Syne is the only product typeface. */
export const bodyFont = displayFont;

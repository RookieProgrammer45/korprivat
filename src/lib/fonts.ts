
import { DM_Sans, Syne } from 'next/font/google';

export const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
});

export const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
});

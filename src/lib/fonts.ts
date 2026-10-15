import { Hanken_Grotesk, Syne } from 'next/font/google';

export const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
});

export const bodyFont = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
});

// Root layout shell. Customize via the seams it imports — see AGENTS.md
// "Customizing the shell" (lang/head/viewport/providers/nav/brand).
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { GlobalMounts } from '@/components/custom/global-mounts';
import { HeadContent } from '@/components/custom/head-content';
import { SiteFooter } from '@/components/custom/site-footer';
import { SiteNav } from '@/components/custom/site-nav';
import { AppProviders } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { defaultLocale, isLocale } from '@/i18n/config';
import { bodyFont, displayFont } from '@/lib/fonts';
import { resolveLocale } from '@/lib/i18n';
import { localeHtmlLang } from '@/lib/seo/locale-path';
import { siteDescription, siteName, siteUrl } from '@/lib/site';
import { viewportConfig } from '@/lib/viewport-config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
  },
};

export const viewport: Viewport = { ...viewportConfig };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const resolved = await resolveLocale();
  const htmlLang = isLocale(resolved) ? localeHtmlLang[resolved] : localeHtmlLang[defaultLocale];

  return (
    <html
      lang={htmlLang}
      dir="ltr"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable}`}
    >
      <body className="min-h-dvh bg-background font-body text-foreground antialiased">
        <HeadContent nonce={nonce} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
          nonce={nonce}
        >
          <AppProviders>
            <SiteNav />
            {children}
            <SiteFooter />
            <Toaster />
            <GlobalMounts />
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

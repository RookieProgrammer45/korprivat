// Root layout shell. Customize via the seams it imports — see AGENTS.md
// "Customizing the shell" (lang/head/viewport/providers/nav/brand).
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { GlobalMounts } from '@/components/custom/global-mounts';
import { HeadContent } from '@/components/custom/head-content';
import { SiteFooter, SiteNav } from '@/components/custom/site-nav';
import { AppProviders } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { locale } from '@/lib/locale';
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
    siteName,
    title: siteName,
    description: siteDescription,
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

  return (
    <html lang={locale.lang} dir={locale.dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        <HeadContent nonce={nonce} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
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

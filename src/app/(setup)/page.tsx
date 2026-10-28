import type { Metadata } from 'next';
import { PublicHome } from '@/components/custom/public-home';
import { siteDescription, siteName } from '@/lib/brand';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: { absolute: `${siteName} – Jämför trafikskolor runtom i landet` },
  description: siteDescription,
  alternates: publicAlternates('/'),
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    siteName,
    title: `${siteName} – Jämför trafikskolor runtom i landet`,
    description: siteDescription,
    url: absoluteUrl('/'),
  },
};

export default function DriveLinkUpLanding() {
  // WebSite structured data — helps search engines and AI engines anchor the
  // brand, the market (Sweden) and the value proposition to this origin.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteName,
        url: absoluteUrl('/'),
        email: 'support@drivelinkup.com',
        areaServed: 'SE',
        description: siteDescription,
      },
      {
        '@type': 'WebSite',
        name: siteName,
        url: absoluteUrl('/'),
        description: siteDescription,
        inLanguage: 'sv-SE',
        publisher: { '@type': 'Organization', name: siteName },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <PublicHome />
    </>
  );
}

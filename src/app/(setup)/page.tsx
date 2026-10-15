import type { Metadata } from 'next';
import { PublicHome } from '@/components/custom/public-home';
import { siteDescription, siteName } from '@/lib/brand';
import { absoluteUrl } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: { absolute: `${siteName} – Jämför trafikskolor & boka körlektioner` },
  description: siteDescription,
  alternates: { canonical: '/' },
};

export default function DriveLinkUpLanding() {
  // WebSite structured data — helps search engines and AI engines anchor the
  // brand, the market (Sweden) and the value proposition to this origin.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: absoluteUrl('/'),
    description: siteDescription,
    inLanguage: 'sv-SE',
    audience: 'Sweden',
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <PublicHome />
    </>
  );
}

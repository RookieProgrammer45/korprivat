
import type { Metadata } from 'next';
import { PublicHome } from '@/components/custom/public-home';
import { siteDescription, siteName } from '@/lib/brand';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
};

export default function DriveLinkUpLanding() {
  return <PublicHome />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocationHubLanding, locationHubMetadata } from '@/components/custom/location-hub-landing';
import { resolveLocation } from '@/lib/seo/catalogue-locations';
import { isNordicCountry, NORDIC_LOCATIONS } from '@/lib/seo/nordic-locations';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ country: string; slug: string }> };

export function generateStaticParams() {
  return NORDIC_LOCATIONS.map((loc) => ({ country: loc.country, slug: loc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const location = resolveLocation(country, slug);
  if (!location) return { title: 'Not found', robots: { index: false, follow: false } };
  return locationHubMetadata(location);
}

export default async function NordicLocationPage({ params }: Props) {
  const { country, slug } = await params;
  if (!isNordicCountry(country)) notFound();
  const location = resolveLocation(country, slug);
  if (!location) notFound();
  return <LocationHubLanding location={location} />;
}

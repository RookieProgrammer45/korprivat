import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocationHubLanding, locationHubMetadata } from '@/components/custom/location-hub-landing';
import { resolveLocation } from '@/lib/seo/catalogue-locations';
import { isNordicCountry, NORDIC_LOCATIONS } from '@/lib/seo/nordic-locations';
import { parseHeroSearchCategory } from '@/lib/seo/school-search-path';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ country: string; slug: string }>;
  searchParams: Promise<{ category?: string }>;
};

export function generateStaticParams() {
  return NORDIC_LOCATIONS.map((loc) => ({ country: loc.country, slug: loc.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const { category } = await searchParams;
  const location = resolveLocation(country, slug);
  if (!location) return { title: 'Not found', robots: { index: false, follow: false } };
  const licence = parseHeroSearchCategory(category);
  return locationHubMetadata(location, licence && licence !== 'B' ? licence : null);
}

export default async function NordicLocationPage({ params, searchParams }: Props) {
  const { country, slug } = await params;
  const { category } = await searchParams;
  if (!isNordicCountry(country)) notFound();
  const location = resolveLocation(country, slug);
  if (!location) notFound();
  return <LocationHubLanding location={location} category={category} />;
}

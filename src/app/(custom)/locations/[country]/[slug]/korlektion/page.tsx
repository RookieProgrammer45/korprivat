import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  LessonComparisonLanding,
  lessonComparisonMetadata,
} from '@/components/custom/lesson-comparison-landing';
import { cityListingStats, publicSchoolsForLocation } from '@/lib/discovery/public-listing';
import { resolveLocation } from '@/lib/seo/catalogue-locations';
import { isLessonComparisonEligible } from '@/lib/seo/lesson-comparison-path';
import { isNordicCountry, NORDIC_LOCATIONS } from '@/lib/seo/nordic-locations';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ country: string; slug: string }> };

export function generateStaticParams() {
  return NORDIC_LOCATIONS.filter((loc) => loc.country === 'se' && loc.kind === 'city').map(
    (loc) => ({ country: loc.country, slug: loc.slug }),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const location = resolveLocation(country, slug);
  if (!location || location.kind !== 'city' || location.country !== 'se') {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }
  return lessonComparisonMetadata(location);
}

export default async function LessonComparisonPage({ params }: Props) {
  const { country, slug } = await params;
  if (!isNordicCountry(country) || country !== 'se') notFound();
  const location = resolveLocation(country, slug);
  if (!location || location.kind !== 'city') notFound();
  const schools = await publicSchoolsForLocation(location);
  const priced = schools.filter((school) => school.publishedPrices?.lesson);
  if (!isLessonComparisonEligible(priced.length)) notFound();
  // Touch stats so a city with only null prices cannot slip through.
  if (!cityListingStats(priced).minLessonSek) notFound();
  return <LessonComparisonLanding location={location} />;
}

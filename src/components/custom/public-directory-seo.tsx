//
// Structured data for the public directory. The interactive directory is the
// only user-visible list so city and other filters stay truthful. Crawlers
// still receive an ItemList JSON-LD of verified listings.

import { absoluteUrl } from '@/lib/seo/alternates';
import { listIndexableInstructors } from '@/lib/seo/public-instructor';
import { schoolPath } from '@/lib/seo/school-slugs';

export async function PublicDirectorySeo() {
  const instructors = await listIndexableInstructors(200);
  if (instructors.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trafikskolor och instruktörer på DriveLinkUp',
    numberOfItems: instructors.length,
    itemListElement: instructors.map((instructor, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(schoolPath(instructor)),
      name: `${instructor.name} — ${instructor.city}`,
    })),
  };

  return <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>;
}

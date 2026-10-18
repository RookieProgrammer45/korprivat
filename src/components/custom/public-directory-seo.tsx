//
// Server-rendered, crawlable index of the public directory. The interactive
// directory above is client-side; this section puts every verified listing's
// name, city and price into the initial HTML so crawlers and AI engines can
// read the full catalog without executing JavaScript. Includes ItemList
// structured data (schema.org) for rich results and LLM extraction.
//
// Swedish strings are intentional (SE-first marketplace); move them to
// messages/sv.json if a public English surface is ever added.

import Link from 'next/link';
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

  return (
    <section
      aria-labelledby="directory-seo-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-16"
    >
      <h2 id="directory-seo-heading" className="font-display text-xl font-semibold text-foreground">
        Alla listade skolor och instruktörer
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {instructors.map((instructor) => (
          <li key={instructor.id}>
            <Link
              href={schoolPath(instructor)}
              className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border px-4 py-3 transition-colors hover:border-foreground/30"
            >
              <span className="truncate font-medium text-foreground">{instructor.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {instructor.city}
                {instructor.hourlyRateSek > 0 ? ` — fr. ${instructor.hourlyRateSek} kr/tim` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </section>
  );
}

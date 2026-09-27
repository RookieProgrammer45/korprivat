// pages (e.g. /champions/[slug]) that aren't in the nav menu. Edit this file,
// never src/app/sitemap.ts (framework-owned). Return one entry per page with an
// app-absolute `path` ('/...'); may be async to fetch data. Return [] if none.
//
//   export async function seoRoutes(): Promise<SeoRoute[]> {
//     const items = await getItems();
//     return items.map((i) => ({ path: `/items/${i.slug}`, priority: 0.6 }));
//   }
import type { MetadataRoute } from 'next';

/** App-absolute `path` (e.g. /items/aatrox) + optional Next sitemap fields. */
export type SeoRoute = { path: string } & Omit<MetadataRoute.Sitemap[number], 'url'>;

export async function seoRoutes(): Promise<SeoRoute[]> {
  return [
    // Editorial regional hub for learners looking for driving instructors and
    // handledare across southern Sweden.
    { path: '/southern-sweden', priority: 0.8, changeFrequency: 'weekly' },
    // Editorial regional hub for learners looking for driving instructors and
    // handledare across western and northern Sweden.
    { path: '/western-northern-sweden', priority: 0.8, changeFrequency: 'weekly' },
    // City-specific SEO landing for the Stockholm pilot cohort. The path is
    // a fixed '/instructors/stockholm' page under src/app/(custom)/…
    // /stockholm/page.tsx and renders the existing <InstructorDirectory />
    // island pre-filtered to `city=Stockholm`. `priority: 0.7` matches other
    // programmatic landings (the sitemap.ts base merges these in after
    // nav items, so it does not clash with the home's `priority: 1`).
    { path: '/instructors/stockholm', priority: 0.7, changeFrequency: 'weekly' },
    // City-specific SEO landing for the Gothenburg pilot cohort. Mirrors
    // Stockholm: a fixed '/instructors/goteborg' page under src/app/(custom)/
    // …/goteborg/page.tsx, renders the existing <InstructorDirectory />
    // island pre-filtered to `city=Goteborg`. Same priority/cadence so search
    // engines index the two city landings uniformly.
    { path: '/instructors/goteborg', priority: 0.7, changeFrequency: 'weekly' },
    // City-specific SEO landing for the Malmö pilot cohort. Mirrors Stockholm
    // and Gothenburg: a fixed '/instructors/malmo' page under src/app/(custom)/
    // …/malmo/page.tsx, renders the existing <InstructorDirectory /> island
    // pre-filtered to `city=Malmo`. Same priority/cadence so search engines
    // index all three city landings uniformly.
    { path: '/instructors/malmo', priority: 0.7, changeFrequency: 'weekly' },
    // City-specific SEO landing for the Uppsala pilot cohort. Mirrors
    // Stockholm / Gothenburg / Malmö: a fixed '/instructors/uppsala' page
    // under src/app/(custom)/…/uppsala/page.tsx, renders the existing
    // <InstructorDirectory /> island pre-filtered to `city=Uppsala`. Same
    // priority/cadence so search engines index all four city landings
    // uniformly.
    { path: '/instructors/uppsala', priority: 0.7, changeFrequency: 'weekly' },
    // Västerås-specific SEO landing with the directory pre-filtered to
    // `city=Västerås` and dedicated handledare/trafiklärare copy.
    { path: '/instructors/vasteras', priority: 0.7, changeFrequency: 'weekly' },
    // Blog index — bilingual, weekly cadence. The page is fully editorial
    // and only contains the one article currently, but indexing it gives
    // search engines a landing for "DriveLinkUp blog" + "driving in sweden
    // guide" exploratory queries. Renders at src/app/(custom)/blog/page.tsx.
    { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
    // First published post — fixed-slug article targeting the Stockholm
    // expat cohort. Monthly cadence: editorial content rotates slowly.
    // Renders at
    // src/app/(custom)/blog/swedish-drivers-license-expat-stockholm/page.tsx
    // and emits its own BlogPosting + BreadcrumbList JSON-LD.
    {
      path: '/blog/swedish-drivers-license-expat-stockholm',
      priority: 0.7,
      changeFrequency: 'monthly',
    },
  ];
}

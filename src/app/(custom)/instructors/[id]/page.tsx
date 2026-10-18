import { notFound, permanentRedirect } from 'next/navigation';
import { loadPublicInstructorSeo } from '@/lib/seo/public-instructor';
import { schoolPath } from '@/lib/seo/school-slugs';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    booking?: string | string[];
    token?: string | string[];
    rebook?: string | string[];
    review?: string | string[];
  }>;
};

// Legacy UUID URLs (/instructors/<uuid>) permanently redirect to the canonical,
// keyword-rich form /trafikskola/<city>/<name>-<id8> (see src/lib/seo/school-slugs.ts).
// Booking/review query params are carried over so old confirmation links keep working.
export default async function InstructorPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const instructor = await loadPublicInstructorSeo(id);
  if (!instructor) notFound();

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length > 0) qs.set(key, first);
  }
  const query = qs.toString();
  permanentRedirect(query ? `${schoolPath(instructor)}?${query}` : schoolPath(instructor));
}

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InstructorDetail } from '@/components/custom/instructor-detail';
import { InstructorOfferingsSection } from '@/components/custom/instructor-offerings-section';
import { ReviewSection } from '@/components/custom/review-section';
import { publishedPrices } from '@/lib/discovery/published-prices';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { loadPublicInstructorBySchoolSlug } from '@/lib/seo/public-instructor';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ city: string; slug: string }>;
  searchParams: Promise<{
    booking?: string | string[];
    token?: string | string[];
    rebook?: string | string[];
    review?: string | string[];
  }>;
};

function publicLessonRate(instructor: { id: string }): number {
  return publishedPrices(instructor.id)?.lesson?.priceSek ?? 0;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await loadPublicInstructorBySchoolSlug(slug);
  const t = await getTranslations('instructorDetail.meta');
  if (!resolved) {
    return {
      title: t('title'),
      description: t('description'),
      robots: { index: false, follow: false },
    };
  }
  const { instructor, canonicalPath } = resolved;
  const path = canonicalPath;
  const title = `${instructor.name} — ${instructor.city} | DriveLinkUp`;
  const rate = publicLessonRate(instructor);
  const description =
    instructor.bio?.trim().slice(0, 155) ||
    (rate > 0
      ? t('descriptionNamed', { name: instructor.name, city: instructor.city, rate })
      : t('description'));
  return {
    title,
    description,
    alternates: publicAlternates(path),
    robots: instructor.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: 'profile',
      siteName,
      title,
      description,
      images: instructor.photoUrl ? [{ url: instructor.photoUrl }] : undefined,
    },
  };
}

export default async function SchoolPage({ params, searchParams }: PageProps) {
  const [{ city, slug }, sp] = await Promise.all([params, searchParams]);
  const resolved = await loadPublicInstructorBySchoolSlug(slug);
  if (!resolved) notFound();

  const requested = `/trafikskola/${city}/${slug}`;
  if (resolved.canonicalPath !== requested) permanentRedirect(resolved.canonicalPath);

  const rawReview = Array.isArray(sp.review) ? sp.review[0] : sp.review;
  const instructorId = resolved.instructor.id;
  const reviewBookingId =
    typeof rawReview === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(rawReview) ? rawReview : null;

  const jsonLd = resolved.instructor?.indexable
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'DriveLinkUp', item: absoluteUrl('/') },
              {
                '@type': 'ListItem',
                position: 2,
                name: resolved.instructor.city,
                item: absoluteUrl('/locations'),
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: resolved.instructor.name,
                item: absoluteUrl(resolved.canonicalPath),
              },
            ],
          },
          {
            '@type': 'DrivingSchool',
            name: resolved.instructor.name,
            description: resolved.instructor.bio?.slice(0, 300) || undefined,
            url: absoluteUrl(resolved.canonicalPath),
            image: resolved.instructor.photoUrl || undefined,
            address: {
              '@type': 'PostalAddress',
              addressLocality: resolved.instructor.city,
              addressCountry: 'SE',
            },
            priceRange:
              publicLessonRate(resolved.instructor) > 0
                ? `${publicLessonRate(resolved.instructor)} SEK`
                : undefined,
            areaServed: resolved.instructor.city,
            knowsLanguage: resolved.instructor.englishSpeaking ? ['sv', 'en'] : ['sv'],
          },
        ],
      }
    : null;

  return (
    <main className="container-page section min-w-0">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="grid min-w-0 gap-6">
          <InstructorDetail instructorId={instructorId} />
          <InstructorOfferingsSection instructorId={instructorId} requestEnabled={false} />
          <ReviewSection instructorId={instructorId} reviewBookingId={reviewBookingId} />
        </div>
      </div>
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </main>
  );
}

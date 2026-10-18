import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BookingForm } from '@/components/custom/booking-form';
import { InstructorDetail } from '@/components/custom/instructor-detail';
import { ReviewSection } from '@/components/custom/review-section';
import { GoogleReviewsSection } from '@/components/custom/google-reviews-section';
import { InstructorOfferingsSection } from '@/components/custom/instructor-offerings-section';
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

type Resolved = NonNullable<Awaited<ReturnType<typeof loadPublicInstructorBySchoolSlug>>>;

/** Any spelling other than the canonical /trafikskola/<city>/<name>-<id8> 308s onto it. */
function isCanonical(resolved: Resolved, city: string, slug: string): boolean {
  return resolved.canonicalPath === `/trafikskola/${city}/${slug}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, slug } = await params;
  const resolved = await loadPublicInstructorBySchoolSlug(city, slug);
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
  const description =
    instructor.bio?.trim().slice(0, 155) ||
    t('descriptionNamed', {
      name: instructor.name,
      city: instructor.city,
      rate: instructor.hourlyRateSek,
    });
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
      url: absoluteUrl(path),
      images: instructor.photoUrl ? [{ url: instructor.photoUrl }] : undefined,
    },
  };
}

export default async function SchoolPage({ params, searchParams }: PageProps) {
  const [{ city, slug }, sp] = await Promise.all([params, searchParams]);
  const resolved = await loadPublicInstructorBySchoolSlug(city, slug);
  if (!resolved) notFound();
  if (!isCanonical(resolved, city, slug)) permanentRedirect(resolved.canonicalPath);

  const instructorId = resolved.instructor.id;
  const rawBooking = Array.isArray(sp.booking) ? sp.booking[0] : sp.booking;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const rawRebook = Array.isArray(sp.rebook) ? sp.rebook[0] : sp.rebook;
  const rawReview = Array.isArray(sp.review) ? sp.review[0] : sp.review;
  const bookingId = typeof rawBooking === 'string' && rawBooking.length > 0 ? rawBooking : null;
  const bookingToken = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : undefined;
  const rebookId = typeof rawRebook === 'string' && rawRebook.length > 0 ? rawRebook : null;
  const reviewBookingId =
    typeof rawReview === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(rawReview) ? rawReview : null;

  const jsonLd =
    resolved.instructor && resolved.instructor.indexable
      ? {
          '@context': 'https://schema.org',
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
            resolved.instructor.hourlyRateSek > 0
              ? `${resolved.instructor.hourlyRateSek} SEK`
              : undefined,
          areaServed: resolved.instructor.city,
          knowsLanguage: resolved.instructor.englishSpeaking ? ['sv', 'en'] : ['sv'],
        }
      : null;

  return (
    <main className="container-page section min-w-0">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <InstructorDetail instructorId={instructorId} />
          <InstructorOfferingsSection instructorId={instructorId} />
          <ReviewSection instructorId={instructorId} reviewBookingId={reviewBookingId} />
          <GoogleReviewsSection instructorId={instructorId} />
        </div>
        <div className="instructor-page-booking min-w-0 lg:sticky lg:top-24">
          <BookingForm
            instructorId={instructorId}
            bookingId={bookingId}
            bookingToken={bookingToken}
            rebookBookingId={rebookId}
          />
        </div>
      </div>
      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </main>
  );
}

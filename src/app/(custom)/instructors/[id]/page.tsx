
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingForm } from '@/components/custom/booking-form';
import { InstructorDetail } from '@/components/custom/instructor-detail';
import { ReviewSection } from '@/components/custom/review-section';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorDetail.meta');
  return {
    title: t('title'),
    description: t('description'),
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    booking?: string | string[];
    token?: string | string[];
    rebook?: string | string[];
    review?: string | string[];
  }>;
};

export default async function InstructorPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const rawBooking = Array.isArray(sp.booking) ? sp.booking[0] : sp.booking;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const rawRebook = Array.isArray(sp.rebook) ? sp.rebook[0] : sp.rebook;
  const rawReview = Array.isArray(sp.review) ? sp.review[0] : sp.review;
  const bookingId = typeof rawBooking === 'string' && rawBooking.length > 0 ? rawBooking : null;
  const bookingToken = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : undefined;
  const rebookId = typeof rawRebook === 'string' && rawRebook.length > 0 ? rawRebook : null;
  const reviewBookingId =
    typeof rawReview === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(rawReview) ? rawReview : null;

  return (
    <main className="container-page min-w-0">
      <div className="mx-auto grid w-full max-w-6xl gap-6 py-section lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <InstructorDetail instructorId={id} />
          <ReviewSection instructorId={id} reviewBookingId={reviewBookingId} />
        </div>
        <div className="instructor-page-booking min-w-0 lg:sticky lg:top-24">
          <BookingForm
            instructorId={id}
            bookingId={bookingId}
            bookingToken={bookingToken}
            rebookBookingId={rebookId}
          />
        </div>
      </div>
    </main>
  );
}

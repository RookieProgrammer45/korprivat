// @polsia:user-owned — public instructor profile and booking shell.

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
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <InstructorDetail instructorId={id} />
        <BookingForm
          instructorId={id}
          bookingId={bookingId}
          bookingToken={bookingToken}
          rebookBookingId={rebookId}
        />
        <ReviewSection instructorId={id} reviewBookingId={reviewBookingId} />
      </div>
    </main>
  );
}

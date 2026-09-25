// @polsia:user-owned — metadata/auth shell for the protected inbox.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MessagingWorkspace } from '@/components/custom/messaging/messaging-workspace';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return {
    title: t('nav.messagesTab'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  searchParams: Promise<{ bookingId?: string | string[] }>;
};

export default async function MessagesPage({ searchParams }: PageProps) {
  const session = await requireDashboardSession('/dashboard/messages');
  if (session.role !== 'STUDENT' && session.role !== 'INSTRUCTOR') {
    redirect(dashboardPathFor(session.role));
  }
  const params = await searchParams;
  const rawBookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  return <MessagingWorkspace initialBookingId={rawBookingId} />;
}

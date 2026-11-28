import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MessagingWorkspace } from '@/components/custom/messaging/messaging-workspace';
import { LocaleLink } from '@/components/locale-link';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';
import { listMyVehicleThreads } from '@/lib/vehicle-sales/threads';

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
  const vehicleThreads = await listMyVehicleThreads(session.userId);
  const sales = await getTranslations('carsForSalePage');
  return (
    <div className="grid gap-6">
      {vehicleThreads.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg">{sales('thread.yours')}</h2>
          <ul className="grid gap-2">
            {vehicleThreads.map((thread) => (
              <li key={thread.id}>
                <LocaleLink
                  className="text-sm underline-offset-4 hover:underline"
                  href={`/bilar-till-salu/${thread.listingId}#conversation`}
                >
                  {thread.title}
                  {thread.otherName ? ` · ${thread.otherName}` : ''}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <MessagingWorkspace initialBookingId={rawBookingId} />
    </div>
  );
}

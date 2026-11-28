import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { VehicleThreadComposer } from '@/components/custom/vehicle-thread';
import { LocaleLink } from '@/components/locale-link';
import { Button } from '@/components/ui/button';
import { loginHrefWithNext, signupHrefWithNext } from '@/lib/auth-next';
import { getSessionUser } from '@/lib/require-auth';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';
import { canUseVehicleChat } from '@/lib/vehicle-sales/conversation-access';
import { findPublicListing } from '@/lib/vehicle-sales/listings';
import { listListingThreads } from '@/lib/vehicle-sales/threads';

type Props = { params: Promise<{ id: string }> };

function money(locale: string, currency: string, amount: number): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await findPublicListing(id);
  if (!listing) return { title: siteName };
  const title = `${listing.make} ${listing.model} · ${listing.city}`;
  return { title, robots: { index: false, follow: false } };
}

export default async function CarForSalePage({ params }: Props) {
  const { id } = await params;
  const listing = await findPublicListing(id);
  if (!listing) notFound();
  const t = await getTranslations('carsForSalePage');
  const locale = await getLocale();
  const user = await getSessionUser();
  const canChat = canUseVehicleChat(user);
  const next = `/bilar-till-salu/${listing.id}`;
  const threads =
    canChat && user ? await listListingThreads(listing.id, user.id, listing.userId) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <LocaleLink
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        href="/bilar-till-salu"
      >
        {t('detail.back')}
      </LocaleLink>
      <h1 className="mt-4 font-display text-4xl tracking-tight">
        {listing.make} {listing.model}
        {listing.year ? ` · ${listing.year}` : ''}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {listing.city} · {listing.country}
      </p>
      {listing.estimateAmount != null &&
      listing.estimateLow != null &&
      listing.estimateHigh != null ? (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">{t('detail.estimate')}</p>
          <p className="font-display text-4xl tracking-tight">
            {money(locale, listing.currency, listing.estimateAmount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('detail.range', {
              low: money(locale, listing.currency, listing.estimateLow),
              high: money(locale, listing.currency, listing.estimateHigh),
              count: listing.estimateCount,
            })}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm">{t('detail.none')}</p>
      )}
      {listing.askingAmount != null ? (
        <p className="mt-4 text-sm">
          {t('card.asking', { amount: money(locale, listing.currency, listing.askingAmount) })}
        </p>
      ) : null}
      {listing.note ? <p className="mt-4 text-sm">{listing.note}</p> : null}
      <section className="mt-8 space-y-3">
        {canChat && user && user.id === listing.userId ? (
          <>
            <h2 id="conversation" className="text-lg">
              {t('thread.title')}
            </h2>
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('thread.emptyOwner')}</p>
            ) : (
              threads.map((thread) => (
                <article key={thread.id} className="space-y-3 rounded-2xl border border-border p-4">
                  <h3 className="text-sm">{t('thread.with', { name: thread.buyerName })}</h3>
                  <ThreadMessages
                    messages={thread.messages}
                    userId={user.id}
                    youLabel={t('thread.you')}
                  />
                  <VehicleThreadComposer listingId={listing.id} conversationId={thread.id} />
                </article>
              ))
            )}
          </>
        ) : canChat && user ? (
          <>
            <h2 id="conversation" className="text-lg">
              {t('thread.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('thread.body')}</p>
            {threads[0] ? (
              <ThreadMessages
                messages={threads[0].messages}
                userId={user.id}
                youLabel={t('thread.you')}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('thread.emptyBuyer')}</p>
            )}
            <VehicleThreadComposer listingId={listing.id} conversationId={threads[0]?.id ?? null} />
          </>
        ) : (
          <>
            <h2 className="text-lg">{t('detail.signInTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('detail.signInBody')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="min-h-11">
                <Link href={localePath(locale, signupHrefWithNext(next))}>
                  {t('detail.signup')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={localePath(locale, loginHrefWithNext(next))}>{t('detail.login')}</Link>
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ThreadMessages({
  messages,
  userId,
  youLabel,
}: {
  messages: { id: string; senderId: string; body: string }[];
  userId: string;
  youLabel: string;
}) {
  return (
    <ol className="space-y-2">
      {messages.map((message) => (
        <li
          key={message.id}
          className={
            message.senderId === userId
              ? 'ml-8 rounded-2xl bg-muted px-3 py-2 text-sm'
              : 'mr-8 rounded-2xl border border-border px-3 py-2 text-sm'
          }
        >
          {message.senderId === userId ? (
            <p className="text-caption text-muted-foreground">{youLabel}</p>
          ) : null}
          <p>{message.body}</p>
        </li>
      ))}
    </ol>
  );
}

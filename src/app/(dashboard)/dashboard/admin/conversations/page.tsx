import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listAdminThreads, readAdminThread } from '@/lib/admin/all-conversations';
import { requireAdminServer } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ kind?: string; id?: string }> };

export default async function AdminConversationsPage({ searchParams }: Props) {
  await requireAdminServer();
  const t = await getTranslations('adminConversationsPage');
  const params = await searchParams;
  const kind = params.kind === 'booking' || params.kind === 'vehicle' ? params.kind : null;
  const threads = await listAdminThreads();
  const messages = kind && params.id ? await readAdminThread(kind, params.id) : [];

  return (
    <main className="grid gap-6 p-6">
      <div>
        <h1 className="font-display text-2xl">{t('title')}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('lead')}</p>
      </div>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {threads.map((thread) => (
            <li key={`${thread.kind}:${thread.id}`}>
              <Link
                className="text-sm underline-offset-4 hover:underline"
                href={`/dashboard/admin/conversations?kind=${thread.kind}&id=${thread.id}`}
              >
                {thread.kind === 'vehicle' ? t('vehicle') : t('booking')} · {thread.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {kind && params.id ? (
        <section className="grid max-w-2xl gap-3">
          <h2 className="text-lg">{t('messages')}</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMessages')}</p>
          ) : (
            <ol className="grid gap-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-2xl border border-border p-4 text-sm">
                  <p className="text-muted-foreground">
                    {message.senderName} · {message.senderEmail}
                  </p>
                  <p className="mt-2">{message.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </main>
  );
}

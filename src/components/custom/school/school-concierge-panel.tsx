import { getTranslations } from 'next-intl/server';
import { isConciergeOnboardingOn } from '@/lib/acquisition/concierge-policy';
import { conciergePanelForUser } from '@/lib/acquisition/concierge-store';

export async function SchoolConciergePanel({ userId }: { userId: string }) {
  if (!isConciergeOnboardingOn()) return null;
  const drafts = await conciergePanelForUser(userId);
  if (!drafts) return null;
  const t = await getTranslations('dashboardSchool');
  return (
    <section className="grid gap-2 rounded-lg border border-border p-4">
      <h2 className="font-display text-lg font-semibold">{t('conciergeTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('conciergeBody')}</p>
      {drafts.length === 0 ? (
        <p className="text-sm">{t('conciergeNone')}</p>
      ) : (
        <ul className="grid gap-1">
          {drafts.map((draft) => (
            <li key={draft.id} className="text-sm">
              {draft.approved ? t('conciergeStateApproved') : t('conciergeStateDraft')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

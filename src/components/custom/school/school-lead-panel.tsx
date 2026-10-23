import { getTranslations } from 'next-intl/server';
import { isLeadDashboardOn } from '@/lib/acquisition/lead-dashboard-policy';
import { leadPanelForUser } from '@/lib/acquisition/lead-dashboard-store';

export async function SchoolLeadPanel({ userId }: { userId: string }) {
  if (!isLeadDashboardOn()) return null;
  const view = await leadPanelForUser(userId);
  if (!view) return null;
  const t = await getTranslations('dashboardSchool');
  return (
    <section className="grid gap-2 rounded-lg border border-border p-4">
      <h2 className="font-display text-lg font-semibold">{t('leadsTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('leadsBody')}</p>
      <p className="text-sm">
        {view.historicalInquiries === 0
          ? t('leadsNone')
          : t('leadsCount', { count: view.historicalInquiries })}
      </p>
      {view.prompts.map((prompt) => (
        <p key={prompt.scope} className="text-sm">
          {t('leadsPromptInquiry')}
        </p>
      ))}
    </section>
  );
}

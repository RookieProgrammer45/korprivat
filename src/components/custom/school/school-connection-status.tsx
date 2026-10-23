import { getTranslations } from 'next-intl/server';
import { isCertificationEnforced } from '@/lib/certification/capability-policy';
import { schoolProductionCapabilities } from '@/lib/certification/capability-store';

export async function SchoolConnectionStatus({ userId }: { userId: string }) {
  if (!isCertificationEnforced()) return null;
  const t = await getTranslations('dashboardSchool');
  const enabled = await schoolProductionCapabilities(userId);
  return (
    <section className="grid gap-2 rounded-lg border border-border p-4">
      <h2 className="font-display text-lg font-semibold">{t('connectionTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('connectionBody')}</p>
      <p className="text-sm">
        {enabled.length === 0
          ? t('connectionNone')
          : t('connectionCapabilities', { list: enabled.join(', ') })}
      </p>
    </section>
  );
}

// @polsia:user-owned — static eligibility card shown on the handledare dashboard
// after clickwrap acceptance. Server Component; no client state needed.

import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';

export async function HandledareEligibilityCard() {
  const t = await getTranslations('dashboard.handledare.eligibility');

  return (
    <Card className="border-brand-500/30 bg-brand-100 dark:bg-brand-900">
      <CardContent className="grid gap-5 p-8">
        <div className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
          <p className="text-h4 text-foreground">{t('title')}</p>
          <p className="text-body text-muted-foreground">{t('body')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-small font-semibold text-foreground">{t('yourRequirementsTitle')}</p>
            <ul className="grid gap-1.5 pl-4">
              <li className="list-disc text-small text-muted-foreground">{t('req0')}</li>
              <li className="list-disc text-small text-muted-foreground">{t('req1')}</li>
            </ul>
          </div>

          <div className="grid gap-2">
            <p className="text-small font-semibold text-foreground">{t('learnerNeedsTitle')}</p>
            <ul className="grid gap-1.5 pl-4">
              <li className="list-disc text-small text-muted-foreground">
                {t('learnerNeedsItem')}
              </li>
            </ul>
          </div>
        </div>

        <p className="border-t border-border pt-4 text-small text-muted-foreground">
          {t('noHandledarkursNote')}
        </p>
      </CardContent>
    </Card>
  );
}

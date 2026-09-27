//
// Server Component: greeting + a "Find learners" CTA + the clickwrap
// status badge. When the user's stored ClickwrapAcceptance row is missing
// or stale, this page renders NO dashboard body — instead it mounts the
// <ClickwrapRenewalCard/> client island so the handledare can re-attest
// without redoing the full signup.
//
// Listings / search / acceptance of bookings is OUT OF SCOPE for this PR:
// the clickwrap + dashboard chrome is the persistence-layer + UI gate that
// the future listing-search endpoint will need (it must filter on
// `{ clickwrapAcceptance: { isNot: null, termsVersion: HANDLEDARE_TERMS_VERSION } }`).
//
// Server-rendered vs client-fetch is split per the data-plane rule:
//   - Server: dashboard greeting, "Find learners" CTA, the renewal card
//     itself (all written-from-page). The guard's read of the acceptance
//     row is INTERNAL — it gates which surface renders, it does NOT flow
//     the row data into the page body.
//   - Client island (<ClickwrapStatusCard/>): calls GET /api/clickwrap to
//     render the "You've accepted terms v.X.Y.Z" badge on the accepted
//     dashboard stub, so the row's { termsVersion, acceptedAt } projection
//     stays zod-validated end-to-end. The page body never has the row
//     data in scope.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ClickwrapRenewalCard } from '@/components/custom/clickwrap-renewal-card';
import { ClickwrapStatusCard } from '@/components/custom/clickwrap-status-card';
import { ProviderOperations } from '@/components/custom/dashboard/provider-operations';
import { HandledareEligibilityCard } from '@/components/custom/handledare-eligibility-card';
import { HandledareUpgradeSection } from '@/components/custom/handledare-upgrade-section';
import { Button } from '@/components/ui/button';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { requireHandledareClickwrap } from '@/lib/handledare-clickwrap-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.handledare');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/handledare' },
    robots: { index: false, follow: false },
  };
}

export default async function HandledareDashboardPage() {
  const ctx = await requireHandledareClickwrap('/dashboard/handledare');

  if (!ctx.isCurrent) {
    const t = await getTranslations('dashboard.handledare.clickwrap');
    const dsT = await getTranslations('dashboard.handledare');

    const eyebrow = ctx.acceptance ? t('renewalEyebrow') : t('pendingEyebrow');
    const renewalTitle = ctx.acceptance ? t('renewalTitle') : t('pendingTitle');
    const renewalBody = ctx.acceptance ? t('renewalBody') : t('pendingBody');

    return (
      <ClickwrapRenewalCard
        eyebrow={eyebrow}
        renewalTitle={renewalTitle}
        renewalBody={renewalBody}
        successToast={t('renewalSuccess')}
        copy={{
          title: dsT('title'),
          versionEyebrow: t('versionEyebrow', { version: HANDLEDARE_TERMS_VERSION }),
          bodyParagraphs: [t('bodyParagraphs.0'), t('bodyParagraphs.1'), t('bodyParagraphs.2')],
          checkboxLabel: t('checkboxLabel'),
          submit: t('submit'),
          submitting: t('submitting'),
          back: t('back'),
          errors: {
            attestationRequired: t('errors.attestationRequired'),
            submitFailed: t('errors.submitFailed'),
          },
        }}
      />
    );
  }

  // isCurrent === true: surface the dashboard chrome. The future
  // learner-listing-search endpoint would hang off this page, gated by a
  // where-clause that requires clickwrapAcceptance.termsVersion ===
  // HANDLEDARE_TERMS_VERSION (already enforced by this very page through
  // `ctx.isCurrent`, so the gate is "the user reached this branch").
  const t = await getTranslations('dashboard.handledare');
  const navT = await getTranslations('dashboard.handledare.clickwrap');
  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/instructors">{t('learnersCta')}</Link>
          </Button>
        </div>
      </header>
      <HandledareEligibilityCard />
      <ProviderOperations />
      <ClickwrapStatusCard
        copy={{
          badge: navT('currentBadge'),
          introTitle: t('statusTitle'),
          introBody: t('statusBody'),
        }}
      />
      <HandledareUpgradeSection />
    </section>
  );
}

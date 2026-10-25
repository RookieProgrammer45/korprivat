import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SchoolScopeDecisionForm } from '@/components/custom/school/school-scope-decision-form';
import { isClaimFunnelOn } from '@/lib/acquisition/claim-policy';
import { requireDashboardSession } from '@/lib/dashboard-guard';
// biome-ignore lint/style/noRestrictedImports: school listing lookup for the representative form
import { prisma } from '@/lib/db';
import { loadFoldedAuthorization } from '@/lib/orgs/school-authorization';
import { emptyScopeDecisionForm } from '@/lib/orgs/scope-decision-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboardSchool.scopeForm');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SchoolAuthorizationsPage() {
  if (!isClaimFunnelOn()) notFound();
  const session = await requireDashboardSession('/dashboard/school/authorizations');
  const listing = await prisma.instructor.findFirst({
    where: { userId: session.userId, providerRole: 'SCHOOL' },
    select: { id: true },
  });
  if (!listing) notFound();
  const representative = await prisma.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId: listing.id, userId: session.userId } },
  });
  if (!representative?.verifiedAt || !representative.evidenceRef) notFound();
  const folded = await loadFoldedAuthorization(listing.id);
  const t = await getTranslations('dashboardSchool.scopeForm');
  const form = emptyScopeDecisionForm();
  return (
    <section className="grid max-w-xl gap-4">
      <h1 className="font-display text-h2 leading-tight">{t('title')}</h1>
      <SchoolScopeDecisionForm
        listingId={listing.id}
        headSequence={folded.headSequence}
        decisionVersion={folded.decisionVersion}
        granted={folded.granted}
      />
      <p className="sr-only">
        {Object.values(form).every((value) => value === false) ? t('nothingPreselected') : ''}
      </p>
    </section>
  );
}

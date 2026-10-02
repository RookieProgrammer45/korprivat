import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SchoolSetupChecklist } from '@/components/custom/dashboard/school-setup-checklist';
import {
  SchoolInstructorRoster,
  type RosterInvite,
  type RosterMember,
} from '@/components/custom/school/school-instructor-roster';
import { SchoolBookingsPanel } from '@/components/custom/school/school-bookings-panel';
import {
  SchoolPayoutsCard,
  type SchoolPayoutsState,
} from '@/components/custom/school/school-payouts-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import {
  listMembershipsForUser,
  listOrgInvites,
  listOrgMembers,
} from '@/lib/orgs/service';
import { refreshConnectStatus } from '@/lib/payments/connect';
import { prisma } from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboardSchool');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/school' },
    robots: { index: false, follow: false },
  };
}

function verificationLabel(
  state: string,
  t: Awaited<ReturnType<typeof getTranslations<'dashboardSchool'>>>,
): string {
  if (state === 'APPROVED') return t('verificationApproved');
  if (state === 'PENDING') return t('verificationPending');
  return t('verificationDraft');
}

function resolvePayoutsState(
  org: {
    stripeAccountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  },
  currentlyDue: string[],
): SchoolPayoutsState {
  if (!org.stripeAccountId) return 'A';
  if (org.chargesEnabled && org.payoutsEnabled) return 'C';
  if (!org.detailsSubmitted || currentlyDue.length > 0) return 'B';
  return 'D';
}

export default async function SchoolDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const session = await requireDashboardSession('/dashboard/school');
  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  const membership = memberships.find((m) => m.role === 'OWNER' || m.role === 'STAFF');
  if (!membership) {
    redirect('/for-skolor');
  }

  let org = membership.organization;
  const t = await getTranslations('dashboardSchool');
  const showSetupChecklist =
    org.verificationState === 'DRAFT' || org.verificationState === 'PENDING';
  const isOwner = membership.role === 'OWNER';
  let currentlyDue: string[] = [];
  const params = await searchParams;
  const openInviteOnMount = params.invite === 'open';

  if (isOwner) {
    try {
      const status = await refreshConnectStatus(org.id);
      currentlyDue = status.currentlyDue;
      const fresh = await prisma.organization.findUnique({ where: { id: org.id } });
      if (fresh) org = fresh;
    } catch (error) {
      console.error('[dashboard/school] refreshConnectStatus failed', error);
    }
  }

  const [rawMembers, rawInvites] = await Promise.all([
    listOrgMembers(org.id),
    listOrgInvites(org.id),
  ]);

  const members: RosterMember[] = rawMembers.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    acceptedAt: m.acceptedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    user: m.user,
  }));
  const invites: RosterInvite[] = rawInvites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
  }));

  const payoutsState = resolvePayoutsState(org, currentlyDue);
  const detailsComplete = Boolean(org.address?.trim() && org.city?.trim() && org.contactEmail?.trim());
  const hasInstructorMember = members.some((m) => m.status === 'ACTIVE' && m.role !== 'OWNER');
  const connectReady = Boolean(org.stripeAccountId && org.chargesEnabled);

  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('welcome', { name: org.name })}
          </h1>
          <Badge
            variant="outline"
            className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
          >
            {verificationLabel(org.verificationState, t)}
          </Badge>
        </div>
        <p className="text-body text-muted-foreground">
          {t('orgNumber', { number: org.organizationNumber })}
        </p>
      </header>

      {showSetupChecklist ? (
        <SchoolSetupChecklist
          flags={{
            detailsComplete,
            hasInstructorMember,
            connectReady,
          }}
          title={t('setupChecklist.title')}
          description={t('setupChecklist.description')}
          stepDetailsLabel={t('setupChecklist.stepDetails')}
          stepDetailsCta={t('setupChecklist.stepDetailsCta')}
          stepInviteLabel={t('setupChecklist.stepInvite')}
          stepInviteCta={t('setupChecklist.stepInviteCta')}
          stepConnectLabel={t('setupChecklist.stepConnect')}
          stepConnectCta={t('setupChecklist.stepConnectCta')}
        />
      ) : null}

      <div id="school-payouts" className="scroll-mt-24">
        <SchoolPayoutsCard organizationId={org.id} state={payoutsState} isOwner={isOwner} />
      </div>

      <div id="instructors" className="scroll-mt-24">
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <SchoolInstructorRoster
              organizationId={org.id}
              isOwner={isOwner}
              members={members}
              invites={invites}
              openInviteOnMount={openInviteOnMount}
            />
          </CardContent>
        </Card>
      </div>

      <SchoolBookingsPanel organizationId={org.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        {(['revenue', 'settings'] as const).map((key) => (
          <Card key={key} className="border-border bg-card">
            <CardContent className="grid gap-2 p-5">
              <p className="font-medium text-foreground">{t(`panels.${key}.title`)}</p>
              {key === 'settings' ? (
                <Button asChild variant="link" size="sm" className="h-auto w-fit p-0">
                  <Link href="/dashboard/school/settings">{t('draftCardCta')}</Link>
                </Button>
              ) : (
                <Button asChild variant="link" size="sm" className="h-auto w-fit p-0">
                  <Link href="/dashboard/school/revenue">{t('panels.revenue.open')}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

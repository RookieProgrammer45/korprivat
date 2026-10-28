//
// Fetches the signed-in profile envelope from GET /api/profile, then renders:
//   1. a brand-tinted header card — avatar block (initial-letter fallback when
//      `image` is empty) + name/email + a soft role chip on the right
//   2. the role-correct upcoming-list (re-using the BookingList shape from
//      the dashboard), role-branched eyebrow + empty body copy
//   3. a quiet danger-zone card at the very bottom — the self-service GDPR
//      erasure (POST /api/profile/delete) behind a confirm dialog
//
// Loading / empty / error states per the data-plane pattern (see
// student-dashboard / instructor-dashboard for the canonical example).

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { ProfilePhotoEditor } from '@/components/custom/profile/profile-photo-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { signOut } from '@/lib/auth-client';
import { DeleteAccountResponse, Profile } from '@/lib/contracts/profile';

type ProfileResponse = ReturnType<typeof Profile.parse>;
type UpcomingItem = ProfileResponse['upcoming']['items'][number];

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: ProfileResponse } | { kind: 'error' };

type PaymentStatus = UpcomingItem['paymentStatus'];

export function ProfilePage({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations('profile');
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });

  const loadProfile = React.useCallback(() => {
    setState({ kind: 'loading' });
    apiFetch('/api/profile', { schema: Profile })
      .then((data) => {
        setState({ kind: 'ready', data });
      })
      .catch(() => {
        setState({ kind: 'error' });
      });
  }, []);

  React.useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    apiFetch('/api/profile', { schema: Profile })
      .then((data) => {
        if (!active) return;
        setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-destructive">{t('loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="border-destructive/40"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { user, role, upcoming, photo } = state.data;
  const eyebrow =
    role === 'INSTRUCTOR'
      ? 'instructorEyebrow'
      : role === 'SCHOOL'
        ? 'schoolEyebrow'
        : 'studentEyebrow';

  return (
    <div className="grid gap-6">
      <ProfileHeader
        user={user}
        role={role}
        stagedImage={photo.status === 'STAGED' ? photo.imageUrl : null}
        onPhotoUploaded={loadProfile}
      />
      {compact ? (
        <Card className="surface-panel border-border bg-card">
          <CardContent className="flex flex-col items-start gap-3 p-8">
            <p className="text-body text-muted-foreground">{t('upcoming.emptyBodyStudent')}</p>
            <Link href="/instructors" className="dlu-ink-pill">
              {t('upcoming.emptyCtaStudent')}
            </Link>
          </CardContent>
        </Card>
      ) : (
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow text-muted-foreground">{t(`upcoming.${eyebrow}`)}</p>
          {upcoming.items.length > 0 ? (
            <p className="text-small text-muted-foreground">
              {t('upcoming.count', { count: upcoming.items.length })}
            </p>
          ) : null}
        </div>
        {upcoming.items.length === 0 ? (
          <Card className="surface-panel border-border bg-card">
            <CardContent className="flex flex-col gap-3 p-8">
              <p className="text-body font-medium text-foreground">{t('upcoming.emptyTitle')}</p>
              <p className="text-small text-muted-foreground">
                {t(
                  role === 'INSTRUCTOR'
                    ? 'upcoming.emptyBodyInstructor'
                    : role === 'SCHOOL'
                      ? 'upcoming.emptyBodySchool'
                      : 'upcoming.emptyBodyStudent',
                )}
              </p>
              <div className="mt-2">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={
                      role === 'INSTRUCTOR'
                        ? '/dashboard/instructor/availability'
                        : role === 'SCHOOL'
                          ? '/dashboard/school'
                          : '/instructors'
                    }
                  >
                    {t(
                      role === 'INSTRUCTOR'
                        ? 'upcoming.emptyCtaInstructor'
                        : role === 'SCHOOL'
                          ? 'upcoming.emptyCtaSchool'
                          : 'upcoming.emptyCtaStudent',
                    )}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {upcoming.items.map((row) => (
              <li key={row.id}>
                <UpcomingCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
      <DeleteAccountSection />
    </div>
  );
}

function ProfileHeader({
  user,
  role,
  stagedImage,
  onPhotoUploaded,
}: {
  user: { name: string; email: string; image: string | null };
  role: ProfileResponse['role'];
  stagedImage: string | null;
  onPhotoUploaded: () => void;
}) {
  const t = useTranslations('profile');
  const initial = user.name?.trim().charAt(0).toUpperCase() || '?';
  return (
    <Card className="surface-card overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="relative grid gap-4 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="relative">
          {user.image ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-card">
              <Image
                src={user.image}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                priority={false}
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-h2 font-bold text-brand-700 select-none dark:bg-brand-900 dark:text-brand-100">
              {initial}
            </div>
          )}
        </div>
        <div className="relative grid gap-1">
          <p className="text-small text-muted-foreground">{t('signedInAs', { name: user.name })}</p>
          <h2 className="font-display text-h3 font-semibold text-foreground">{user.name}</h2>
          <p className="text-small text-muted-foreground">{user.email}</p>
        </div>
        <div className="relative flex flex-col items-start gap-2 sm:items-end">
          <p className="text-eyebrow text-muted-foreground">{t('role.label')}</p>
          <Badge
            variant="outline"
            className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
          >
            {t(
              role === 'INSTRUCTOR'
                ? 'role.instructor'
                : role === 'HANDLEDARE'
                  ? 'role.handledare'
                  : role === 'SCHOOL'
                    ? 'role.school'
                    : 'role.learner',
            )}
          </Badge>
          <ProfilePhotoEditor
            role={role}
            name={user.name}
            hasImage={Boolean(user.image)}
            stagedImage={stagedImage}
            onUploaded={onPhotoUploaded}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingCard({ row }: { row: UpcomingItem }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  return (
    <Card className="surface-card border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
      <CardContent className="grid gap-2 p-5 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-foreground">
            {row.counterpartyName}
          </span>
          <span className="text-small text-muted-foreground">{row.category}</span>
        </div>
        <span className="text-small text-foreground">{formatDate(row.preferredAt, locale)}</span>
        <PaymentBadge status={row.paymentStatus} />
        <Button asChild variant="ghost" size="sm" className="justify-self-end">
          <Link href={`/bookings/${encodeURIComponent(row.id)}`}>{t('upcoming.open')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('profile');
  switch (status) {
    case 'unpaid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.unpaid')}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          {t('paymentStatus.pending')}
        </Badge>
      );
    case 'paid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.paid')}
        </Badge>
      );
    case 'held_escrow':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.heldEscrow')}
        </Badge>
      );
    case 'released':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.released')}
        </Badge>
      );
    case 'refunded':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.refunded')}
        </Badge>
      );
    case 'awaiting_approval':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.awaitingApproval')}
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.declined')}
        </Badge>
      );
    case 'cancelled_early':
    case 'cancelled_late':
    case 'cancelled_full_refund':
    case 'cancelled_partial':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.cancelled')}
        </Badge>
      );
  }
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Stockholm',
    }).format(d);
  } catch {
    return iso;
  }
}

//
// Danger zone — the GDPR art. 17 erasure promised on /privacy, wired to the
// button at the bottom of the profile. Two-step confirm so
// a stray click can't nuke an account: the dialog restates what disappears,
// and the POST runs the full transactional erase server-side. On success the
// session row is already cascade-deleted, so we sign the stale cookie out
// (best effort) and send the user home.
//
function DeleteAccountSection() {
  const t = useTranslations('profile');
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await apiFetch('/api/profile/delete', {
        method: 'POST',
        schema: DeleteAccountResponse,
      });
      toast.success(t('deleteAccount.done'));
      setOpen(false);
      try {
        await signOut();
      } catch {
        // The session row is already gone — an error here means the cookie
        // is inert; the redirect below lands on a logged-out app either way.
      }
      router.push('/');
      router.refresh();
    } catch {
      toast.error(t('deleteAccount.error'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <p className="text-body font-medium text-foreground">{t('deleteAccount.title')}</p>
          <p className="text-small text-muted-foreground">{t('deleteAccount.body')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 self-start sm:self-auto"
            >
              {t('deleteAccount.cta')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteAccount.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('deleteAccount.dialogBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                {t('deleteAccount.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? t('deleteAccount.deleting') : t('deleteAccount.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

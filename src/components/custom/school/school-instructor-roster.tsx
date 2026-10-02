'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type RosterMember = {
  id: string;
  role: string;
  status: string;
  acceptedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

export type RosterInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

type Props = {
  organizationId: string;
  isOwner: boolean;
  members: RosterMember[];
  invites: RosterInvite[];
  /** Open the invite dialog once on mount (checklist deep-link). */
  openInviteOnMount?: boolean;
};

export function SchoolInstructorRoster({
  organizationId,
  isOwner,
  members,
  invites,
  openInviteOnMount = false,
}: Props) {
  const t = useTranslations('schoolInstructors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!openInviteOnMount || !isOwner) return;
    setOpen(true);
    const url = new URL(window.location.href);
    if (url.searchParams.has('invite')) {
      url.searchParams.delete('invite');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', next);
    }
  }, [openInviteOnMount, isOwner]);

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const hasAnyone = activeMembers.length > 0 || invites.length > 0;

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInlineError(null);
    try {
      const res = await fetch(`/api/orgs/${organizationId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'STAFF' }),
      });
      if (res.status === 409) {
        setInlineError(t('inviteDuplicate'));
        return;
      }
      if (!res.ok) {
        setInlineError(t('inviteError'));
        return;
      }
      toast.success(t('inviteSuccess'));
      setOpen(false);
      setEmail('');
      router.refresh();
    } catch {
      setInlineError(t('inviteError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend(inviteId: string) {
    setBusyId(inviteId);
    try {
      const res = await fetch(`/api/orgs/${organizationId}/invites/${inviteId}/resend`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(t('inviteSuccess'));
        router.refresh();
      } else {
        toast.error(t('inviteError'));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(inviteId: string) {
    setBusyId(inviteId);
    try {
      const res = await fetch(`/api/orgs/${organizationId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('inviteCancelled'));
        router.refresh();
      } else {
        toast.error(t('inviteError'));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onRevoke(membershipId: string) {
    if (!window.confirm(t('revokeConfirm'))) return;
    setBusyId(membershipId);
    try {
      const res = await fetch(`/api/orgs/${organizationId}/memberships/${membershipId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('removeSuccess'));
        router.refresh();
      } else {
        toast.error(t('inviteError'));
      }
    } finally {
      setBusyId(null);
    }
  }

  function roleLabel(role: string) {
    return role === 'OWNER' ? t('roleOwner') : t('roleStaff');
  }

  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h3 text-foreground">{t('title')}</h2>
        {isOwner ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            {t('inviteCta')}
          </Button>
        ) : null}
      </div>

      {!hasAnyone ? (
        <div className="grid gap-2">
          <p className="font-medium text-foreground">{t('emptyTitle')}</p>
          <p className="text-small text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {activeMembers.length > 0 ? (
            <ul className="grid gap-3">
              {activeMembers.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
                >
                  <div className="grid gap-0.5">
                    <p className="font-medium text-foreground">{m.user.name}</p>
                    <p className="text-small text-muted-foreground">{m.user.email}</p>
                    <p className="text-small text-muted-foreground">
                      {t('joinedAt', {
                        date: formatDate(m.acceptedAt ?? m.createdAt),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{roleLabel(m.role)}</Badge>
                    {isOwner && m.role !== 'OWNER' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === m.id}
                        onClick={() => onRevoke(m.id)}
                      >
                        {t('revoke')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {invites.length > 0 ? (
            <div className="grid gap-3">
              <h3 className="font-medium text-foreground">{t('pendingTitle')}</h3>
              <ul className="grid gap-3">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
                  >
                    <div className="grid gap-0.5">
                      <p className="font-medium text-foreground">{inv.email}</p>
                      <p className="text-small text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </p>
                    </div>
                    {isOwner ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busyId === inv.id}
                          onClick={() => onResend(inv.id)}
                        >
                          {t('resend')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === inv.id}
                          onClick={() => onCancel(inv.id)}
                        >
                          {t('cancel')}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setEmail('');
            setInlineError(null);
            setSubmitting(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('inviteCta')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onInvite} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">{t('emailLabel')}</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <p className="text-small text-muted-foreground">{roleLabel('STAFF')}</p>
            {inlineError ? <p className="text-small text-destructive">{inlineError}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {t('inviteCta')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

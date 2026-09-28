'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  token: string;
  orgName: string;
};

export function AcceptInviteButton({ token, orgName }: Props) {
  const t = useTranslations('inviteAccept');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/invites/${token}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'wrong_email') {
          setError(t('wrongEmail', { email: '' }));
        } else if (data.error === 'expired') {
          setError(t('expired'));
        } else {
          setError(t('expired'));
        }
        return;
      }
      setDone(true);
      router.push('/dashboard/school');
      router.refresh();
    } catch {
      setError(t('expired'));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-3">
        <p className="font-medium text-foreground">{t('successTitle')}</p>
        <p className="text-body text-muted-foreground">{t('successBody', { name: orgName })}</p>
        <Button asChild className="w-fit">
          <Link href="/dashboard/school">{t('goToDashboard')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <Button type="button" onClick={onAccept} disabled={loading} className="w-fit">
        {t('acceptCta')}
      </Button>
      {error ? <p className="text-small text-destructive">{error}</p> : null}
    </div>
  );
}

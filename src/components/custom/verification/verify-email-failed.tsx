
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function VerifyEmailFailed({ email }: { email?: string | null }) {
  const t = useTranslations('verifyEmail');
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) {
      toast.error(t('resendNeedsEmail'));
      return;
    }
    setSending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/signup?step=photo',
      });
      if (error) {
        toast.error(t('resendFailed'));
        return;
      }
      toast.success(t('resent'));
    } catch {
      toast.error(t('resendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground">
          {t('invalid')}
        </h1>
        <p className="text-pretty text-body text-muted-foreground">{t('invalidBody')}</p>
      </div>
      <Button type="button" onClick={() => void resend()} disabled={sending || !email}>
        {sending ? t('resending') : t('resendNew')}
      </Button>
    </div>
  );
}

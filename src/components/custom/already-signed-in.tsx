'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

/**
 * Signed-in visitors hitting /signup who are past the wizard — continue to
 * their dashboard or log out, instead of being dumped into learner Didit.
 */
export function AlreadySignedIn({ home, email }: { home: string; email: string }) {
  const t = useTranslations('auth.signUp.alreadySignedIn');
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
      router.push(`${window.location.pathname}${window.location.search}` || '/signup');
      router.refresh();
    } catch {
      toast.error(t('signOutError'));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-h3 text-foreground">{t('title')}</h1>
        <p className="text-body text-muted-foreground">{t('lead', { email })}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button asChild>
          <Link href={home}>{t('continue')}</Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
          {t('signOut')}
        </Button>
      </div>
    </div>
  );
}

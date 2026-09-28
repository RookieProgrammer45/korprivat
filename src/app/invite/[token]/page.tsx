import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AcceptInviteButton } from '@/components/custom/school/accept-invite-button';
import { Button } from '@/components/ui/button';
import { getInviteByToken } from '@/lib/orgs/service';
import { getSessionUser } from '@/lib/require-auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inviteAccept');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations('inviteAccept');
  const invite = await getInviteByToken(token);
  const session = await getSessionUser();

  if (!invite) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
        <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
        <p className="text-body text-muted-foreground">{t('expired')}</p>
      </main>
    );
  }

  const expired = !invite.acceptedAt && invite.expiresAt.getTime() < Date.now();
  if (expired) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
        <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
        <p className="text-body text-muted-foreground">{t('expired')}</p>
      </main>
    );
  }

  if (invite.acceptedAt) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
        <h1 className="font-display text-h2 text-foreground">{t('successTitle')}</h1>
        <p className="text-body text-muted-foreground">
          {t('successBody', { name: invite.organization.name })}
        </p>
        <Button asChild className="w-fit">
          <Link href="/dashboard/school">{t('goToDashboard')}</Link>
        </Button>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
        <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
        <p className="text-body text-muted-foreground">
          {t('body', { name: invite.organization.name })}
        </p>
        <p className="text-body text-muted-foreground">{t('loginPrompt')}</p>
        <Button asChild className="w-fit">
          <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>
            {t('signupCta')}
          </Link>
        </Button>
      </main>
    );
  }

  const sessionEmail = session.email.trim().toLowerCase();
  if (sessionEmail !== invite.email) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
        <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
        <p className="text-body text-destructive">
          {t('wrongEmail', { email: invite.email })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-lg content-center gap-4 px-4 py-16">
      <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
      <p className="text-body text-muted-foreground">
        {t('body', { name: invite.organization.name })}
      </p>
      <AcceptInviteButton token={token} orgName={invite.organization.name} />
    </main>
  );
}

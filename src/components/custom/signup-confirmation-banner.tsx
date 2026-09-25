// @polsia:user-owned — in-app signup confirmation banner.
//
// Rendered once in the /dashboard layout shell. Reads `?signup=1` from the
// URL via useSearchParams() and shows an inline success card so the user
// sees an explicit confirmation that their account was created — paired
// with the welcome email that /api/auth/welcome dispatched race-safely
// during submitAccount. Renders null when the flag is absent, so existing
// dashboard renders are unaffected.
//
// Auto-dismisses after 8s and on click. The query flag is cleared from the
// URL on first render (router.replace with the same pathname, no query) so
// a refresh does not re-trigger the banner.

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DISMISS_MS = 8000;

export function SignupConfirmationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('dashboard.signupConfirmation');
  const [visible, setVisible] = useState(false);

  // Read the flag once on mount. Suspense at the call site wraps this so
  // useSearchParams is safe during prerender.
  useEffect(() => {
    const flagged = searchParams?.get('signup') === '1';
    if (!flagged) return;
    setVisible(true);
    // Clear the flag from the URL so a refresh or back/forward does not
    // re-trigger the banner. The state `visible` carries the dismissal.
    router.replace(pathname);
    const timer = setTimeout(() => setVisible(false), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [searchParams, pathname, router]);

  if (!visible) return null;

  return (
    <Card
      role="status"
      aria-live="polite"
      className="border-emerald-500/40 bg-emerald-500/5 shadow-md"
    >
      <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <p className="text-h4 font-semibold text-foreground">{t('title')}</p>
          <p className="text-body text-muted-foreground">{t('body')}</p>
          <p className="text-small text-muted-foreground">{t('emailNote')}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible(false)}
          className="self-start"
        >
          {t('dismiss')}
        </Button>
      </CardContent>
    </Card>
  );
}

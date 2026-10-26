// Full-bleed photograph for the sign-in split (desktop only).

'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

export function AuthSchoolCarousel() {
  const t = useTranslations('auth.signIn.visual');

  return (
    <aside
      className="auth-visual relative hidden min-h-dvh overflow-hidden lg:block lg:h-full"
      aria-label={t('label')}
    >
      <Image
        src="/images/hero-lesson.jpg"
        alt={t('fallbackAlt')}
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
    </aside>
  );
}

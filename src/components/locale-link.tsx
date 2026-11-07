'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { ComponentProps } from 'react';
import { localePath } from '@/lib/seo/locale-path';

type Props = ComponentProps<typeof Link>;

/** Public `next/link` that keeps the active locale prefix on internal hrefs. */
export function LocaleLink({ href, ...props }: Props) {
  const locale = useLocale();
  const localized =
    typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')
      ? localePath(locale, href)
      : href;
  return <Link href={localized} {...props} />;
}

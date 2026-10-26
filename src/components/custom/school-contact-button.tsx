'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SchoolContactHref = {
  kind: 'inbox' | 'website';
  href: string;
};

export function SchoolContactButton({
  name,
  contact,
  className,
  size = 'lg',
}: {
  name: string;
  contact: SchoolContactHref | null | undefined;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  const tr = useTranslations('schoolContact');
  if (!contact) return null;
  const external = contact.kind === 'website';
  return (
    <Button asChild size={size} className={cn(className)}>
      <a
        href={contact.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={
          contact.kind === 'inbox' ? tr('inboxAria', { name }) : tr('websiteAria', { name })
        }
      >
        {tr('label')}
      </a>
    </Button>
  );
}

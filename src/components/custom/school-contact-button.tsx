'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { claimListingHref } from '@/lib/contact/claim-listing';
import { cn } from '@/lib/utils';

export type SchoolContactHref = {
  kind: 'inbox' | 'website';
  href: string;
};

type Size = 'sm' | 'default' | 'lg';

// Price request (schools without website prices) first, then the school's
// contact. Both go straight to the school; DriveLinkUp relays nothing.
export function SchoolContactActions({
  name,
  contact,
  priceRequest,
  listing,
  className,
  size = 'lg',
}: {
  name: string;
  contact: SchoolContactHref | null | undefined;
  priceRequest?: SchoolContactHref | null;
  listing?: string | null;
  className?: string;
  size?: Size;
}) {
  const claim = listing ? (
    <ClaimSchoolButton name={name} listing={listing} size={size} className={className} />
  ) : null;
  if (!priceRequest) {
    return (
      <>
        <SchoolContactButton name={name} contact={contact} size={size} className={className} />
        {claim}
      </>
    );
  }
  return (
    <>
      <PriceRequestButton name={name} target={priceRequest} size={size} className={className} />
      {contact ? (
        <SchoolContactButton
          name={name}
          contact={contact}
          size={size}
          variant="outline"
          className={className}
        />
      ) : null}
      {claim}
    </>
  );
}

export function ClaimSchoolButton({
  name,
  listing,
  className,
  size = 'lg',
}: {
  name: string;
  listing: string;
  className?: string;
  size?: Size;
}) {
  const tr = useTranslations('schoolContact');
  return (
    <Button asChild size={size} variant="outline" className={cn(className)}>
      <Link href={claimListingHref({ name, listing })} aria-label={tr('claimAria', { name })}>
        {tr('claim')}
      </Link>
    </Button>
  );
}

export function SchoolContactButton({
  name,
  contact,
  className,
  size = 'lg',
  variant,
}: {
  name: string;
  contact: SchoolContactHref | null | undefined;
  className?: string;
  size?: Size;
  variant?: 'outline';
}) {
  const tr = useTranslations('schoolContact');
  if (!contact) return null;
  const external = contact.kind === 'website';
  return (
    <Button asChild size={size} variant={variant} className={cn(className)}>
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

function PriceRequestButton({
  name,
  target,
  className,
  size,
}: {
  name: string;
  target: SchoolContactHref;
  className?: string;
  size: Size;
}) {
  const tr = useTranslations('schoolContact');
  const href =
    target.kind === 'inbox'
      ? `${target.href}?subject=${encodeURIComponent(tr('priceRequestSubject'))}&body=${encodeURIComponent(tr('priceRequestBody', { name }))}`
      : target.href;
  const external = target.kind === 'website';
  return (
    <Button asChild size={size} className={cn(className)}>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={tr('priceRequestAria', { name })}
      >
        {tr('priceRequest')}
      </a>
    </Button>
  );
}

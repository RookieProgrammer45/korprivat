'use client';

import type { ReactNode } from 'react';

const STORAGE_KEY = 'consent_v1';

function analyticsAllowed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { scope?: { analytics?: boolean } };
    return parsed.scope?.analytics === true;
  } catch {
    return false;
  }
}

/** Records that a visitor opened a published listing. No consent, no record. */
export function rememberCatalogueOpen(catalogue: string, itemId: string): void {
  if (!analyticsAllowed()) return;
  const body = new Blob([JSON.stringify({ catalogue, itemId })], { type: 'application/json' });
  navigator.sendBeacon('/api/catalogue-rank', body);
}

export function CatalogueOutboundLink({
  catalogue,
  itemId,
  href,
  className,
  children,
  newTab = true,
}: {
  catalogue: string;
  itemId: string;
  href: string;
  className?: string;
  children: ReactNode;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={className}
      onClick={() => rememberCatalogueOpen(catalogue, itemId)}
    >
      {children}
    </a>
  );
}

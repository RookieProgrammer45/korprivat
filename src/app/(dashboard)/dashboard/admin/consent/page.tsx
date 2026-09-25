// @polsia:user-owned — `/dashboard/admin/consent` — GDPR consent-event audit
// surface (Article 30 records of processing).
//
// Server Component shell — calls `requireAdminServer()` at the top (which
// redirects unauthenticated / non-admin users) then renders a client island
// that fetches the audit rows via /api/admin/consent with the nextjs-data-plane
// loading/empty/error pattern.

import type { Metadata } from 'next';
import { ConsentTable } from '@/components/custom/admin/consent-table';
import { requireAdminServer } from '@/lib/admin-guard';

export const metadata: Metadata = {
  title: 'Consent audit',
  robots: { index: false, follow: false },
};

export default async function AdminConsentPage() {
  await requireAdminServer();
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">Admin</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          Consent audit
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">
          Last 200 GDPR / cookie / privacy-policy decisions recorded across the consent banner,
          signup, and licence-upload steps. (Article 30 records of processing.)
        </p>
      </header>
      <ConsentTable />
    </section>
  );
}

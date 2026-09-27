//
// Server Component shell — `requireAdminServer()` runs server-side and
// redirects non-admins, so the page is gated before any data is read.
// The interactive table (fetch + "Run cleanup now" button) lives in
// the client island imported below.

import type { Metadata } from 'next';
import { CleanupRunsTable } from '@/components/custom/admin/cleanup-runs-table';
import { requireAdminServer } from '@/lib/admin-guard';

export const metadata: Metadata = {
  title: 'R2 cleanup runs',
  robots: { index: false, follow: false },
};

export default async function AdminCleanupRunsPage() {
  await requireAdminServer();
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">Admin</p>
        <h1 className="text-h2 leading-tight tracking-tight text-foreground">R2 cleanup runs</h1>
        <p className="max-w-2xl text-body text-muted-foreground">
          Auto-deletes R2 objects not referenced by any User, Instructor, or Review row. The
          scheduled job runs weekly (Sunday 03:00 UTC); the button below triggers the same logic on
          demand and writes a new audit row.
        </p>
      </header>
      <CleanupRunsTable />
    </section>
  );
}

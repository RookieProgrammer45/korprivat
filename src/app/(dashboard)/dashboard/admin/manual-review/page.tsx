import type { Metadata } from 'next';
import { ManualReviewTable } from '@/components/custom/admin/manual-review-table';
import { requireAdminServer } from '@/lib/admin-guard';

export const metadata: Metadata = {
  title: 'Learner manual review',
  robots: { index: false, follow: false },
};

export default async function AdminManualReviewPage() {
  await requireAdminServer();
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">Admin</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          Learner manual review
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">
          Learners who exhausted Didit attempts or hit claimed/verified DOB mismatch. Resolve to
          ACTIVE or BLOCKED_UNDERAGE.
        </p>
      </header>
      <ManualReviewTable />
    </section>
  );
}

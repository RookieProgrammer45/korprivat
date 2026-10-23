import { SchoolComplaintForm } from '@/components/custom/admin/school-complaint-form';
import { requireAdminServer } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function SchoolComplaintsPage() {
  await requireAdminServer();
  return (
    <main className="grid gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">School complaints</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Record the complaint and its evidence, suspend the disputed scopes, then confirm the
        response shows those public surfaces disabled. Restoring a scope requires a fresh grant
        from a verified school representative. It cannot be done from this form.
      </p>
      <SchoolComplaintForm />
    </main>
  );
}

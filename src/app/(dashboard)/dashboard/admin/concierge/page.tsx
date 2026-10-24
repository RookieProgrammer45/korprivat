import { isConciergeOnboardingOn } from '@/lib/acquisition/concierge-policy';
import { listConciergeDrafts } from '@/lib/acquisition/concierge-store';
import { requireAdminServer } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminConciergePage() {
  await requireAdminServer();
  const rows = isConciergeOnboardingOn() ? await listConciergeDrafts() : [];
  return (
    <main className="grid gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">Concierge drafts</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Prefill stays a draft until the school approves it. Provenance is stored. This tooling does
        not approve a policy, write verification, or grant booking scopes.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No concierge drafts recorded.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((draft) => (
            <li key={draft.id} className="text-sm">
              {draft.listingId} · {draft.state} · {draft.source}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

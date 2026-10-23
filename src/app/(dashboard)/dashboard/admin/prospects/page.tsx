import { isClaimFunnelOn } from '@/lib/acquisition/claim-policy';
import { listProspectsForAdmin } from '@/lib/acquisition/claim-store';
import { requireAdminServer } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminProspectsPage() {
  await requireAdminServer();
  const rows = isClaimFunnelOn() ? await listProspectsForAdmin() : [];
  return (
    <main className="grid gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">Prospects</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Imported prospects stay private until eligibility and data-quality checks pass. A claim does
        not grant booking scopes. Register collection stays blocked until reuse rights are verified.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prospects recorded.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((prospect) => (
            <li key={prospect.id} className="text-sm">
              {prospect.legalName} · {prospect.city} · {prospect.visibility} · {prospect.claimState}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

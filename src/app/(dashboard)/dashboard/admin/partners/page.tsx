import { requireAdminServer } from '@/lib/admin-guard';
import { listPartnersForAdmin } from '@/lib/certification/capability-store';

export const dynamic = 'force-dynamic';

export default async function AdminPartnersPage() {
  await requireAdminServer();
  const rows = await listPartnersForAdmin();
  return (
    <main className="grid gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">Partners</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Availability certification does not enable booking. Transactional booking stays off until
        milestone 5 evidence from a vendor environment is stored. Payment collection stays off until
        the payment-provider decision is recorded.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No partners recorded.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((partner) => (
            <li key={partner.id} className="text-sm">
              {partner.legalName} · {partner.country} · {partner.status}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

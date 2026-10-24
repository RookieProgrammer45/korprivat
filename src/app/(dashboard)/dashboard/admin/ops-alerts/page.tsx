import { requireAdminServer } from '@/lib/admin-guard';
import { isOpsAlertingOn } from '@/lib/ops/alerting-policy';
import { readOpsAlertSnapshot } from '@/lib/ops/alerting-store';

export const dynamic = 'force-dynamic';

export default async function AdminOpsAlertsPage() {
  await requireAdminServer();
  const snapshot = isOpsAlertingOn() ? await readOpsAlertSnapshot() : null;
  return (
    <main className="grid gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">Ops alerts</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Leading metrics from the product spec. Thresholds fire only after an operator sets a
        measured baseline. Availability certification still does not enable booking.
      </p>
      {!snapshot ? (
        <p className="text-sm text-muted-foreground">Ops alerting is off.</p>
      ) : (
        <ul className="grid gap-2">
          {snapshot.metrics.map((metric) => (
            <li key={metric.id} className="text-sm">
              {metric.id} · {metric.value ?? 'n/a'} · {metric.baseline}
              {metric.firing ? ' · firing' : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { prisma } from '@/lib/db';
import {
  evaluateAlert,
  LEADING_METRIC_IDS,
  type LeadingMetricId,
  readConfiguredThresholds,
  THRESHOLD_METRIC_IDS,
  type ThresholdMetricId,
} from '@/lib/ops/alerting-policy';

export type MetricSurface = {
  id: LeadingMetricId | ThresholdMetricId;
  value: number | null;
  breakdown?: Record<string, number>;
  threshold: number | null;
  firing: boolean;
  baseline: 'unmeasured' | 'configured';
};

function db() {
  return prisma as unknown as {
    instructor?: {
      findMany: (args: unknown) => Promise<Array<{ bookingMode: string | null }>>;
    };
    schoolConnection?: { count: (args: unknown) => Promise<number> };
    partner?: { count: (args: unknown) => Promise<number> };
    certification?: { count: (args: unknown) => Promise<number> };
    booking?: {
      count: (args: unknown) => Promise<number>;
      findMany: (args: unknown) => Promise<Array<{ createdAt: Date; acceptedAt: Date | null }>>;
    };
    bookingEvent?: { count: (args: unknown) => Promise<number> };
    commandOutbox?: {
      count: (args: unknown) => Promise<number>;
      findMany: (args: unknown) => Promise<Array<{ createdAt: Date }>>;
    };
    opsTask?: { count: (args: unknown) => Promise<number> };
  };
}

async function count(
  table: { count: (args: unknown) => Promise<number> } | undefined,
  args: unknown,
) {
  if (!table) return 0;
  return table.count(args);
}

export async function readOpsAlertSnapshot(now = new Date()): Promise<{
  generatedAt: string;
  metrics: MetricSurface[];
  alerts: MetricSurface[];
}> {
  const client = db();
  const schools = client.instructor
    ? await client.instructor.findMany({
        where: { providerRole: 'SCHOOL' },
        select: { bookingMode: true },
      })
    : [];
  const byMode: Record<string, number> = {};
  for (const school of schools) {
    const mode = school.bookingMode ?? 'unspecified';
    byMode[mode] = (byMode[mode] ?? 0) + 1;
  }

  const [activeConnections, partnerApplications, milestoneRows, requestTotal, requestPending] =
    await Promise.all([
      count(client.schoolConnection, { where: { status: { not: 'inactive' } } }),
      count(client.partner, { where: { status: 'CANDIDATE' } }),
      count(client.certification, {}),
      count(client.booking, { where: { bookingMode: 'request' } }),
      count(client.booking, {
        where: { bookingMode: 'request', paymentStatus: 'awaiting_approval' },
      }),
    ]);

  const accepted = requestTotal - requestPending;
  const acceptanceRate = requestTotal === 0 ? null : accepted / requestTotal;

  const acceptedRows = client.booking
    ? await client.booking.findMany({
        where: { bookingMode: 'request', acceptedAt: { not: null } },
        select: { createdAt: true, acceptedAt: true },
      })
    : [];
  const latencies: number[] = [];
  for (const row of acceptedRows) {
    if (!row.acceptedAt) continue;
    latencies.push((row.acceptedAt.getTime() - row.createdAt.getTime()) / 1000);
  }
  const acceptanceLatency =
    latencies.length === 0
      ? null
      : latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

  const [inboxDepth, inboxDead, inboxTotal, outboxDead, outboxTotal, drift, quarantines] =
    await Promise.all([
      count(client.bookingEvent, {
        where: { processingStatus: { in: ['received', 'processing'] } },
      }),
      count(client.bookingEvent, { where: { processingStatus: 'dead_letter' } }),
      count(client.bookingEvent, {}),
      count(client.commandOutbox, { where: { deadLetterAt: { not: null } } }),
      count(client.commandOutbox, {}),
      count(client.opsTask, { where: { state: 'open', kind: 'late_captured' } }),
      client.commandOutbox
        ? client.commandOutbox.findMany({
            where: { quarantineResourceRef: { not: null }, resolutionKind: null },
            select: { createdAt: true },
          })
        : Promise.resolve([]),
    ]);

  const deadLetterTotal = inboxDead + outboxDead;
  const processedTotal = inboxTotal + outboxTotal;
  const deadLetterRate = processedTotal === 0 ? null : deadLetterTotal / processedTotal;
  const oldestQuarantineAge =
    quarantines.length === 0
      ? 0
      : Math.max(...quarantines.map((row) => (now.getTime() - row.createdAt.getTime()) / 1000));

  const values: Record<LeadingMetricId | ThresholdMetricId, number | null> = {
    schools_by_mode: schools.length,
    active_connections: activeConnections,
    partner_applications_in_flight: partnerApplications,
    milestone_throughput: milestoneRows,
    request_acceptance_rate: acceptanceRate,
    request_acceptance_latency: acceptanceLatency,
    inbox_depth: inboxDepth,
    dead_letter_rate: deadLetterRate,
    reconciliation_drift_incidents: drift,
    unresolved_quarantine_age: oldestQuarantineAge,
  };

  const thresholds = readConfiguredThresholds();
  const metrics = LEADING_METRIC_IDS.map((id) => {
    const threshold = id in thresholds ? thresholds[id as ThresholdMetricId] : null;
    const evaluated = evaluateAlert({ value: values[id], threshold });
    return {
      id,
      value: values[id],
      ...(id === 'schools_by_mode' ? { breakdown: byMode } : {}),
      threshold,
      ...evaluated,
    };
  });
  const alerts = THRESHOLD_METRIC_IDS.map((id) => {
    const evaluated = evaluateAlert({ value: values[id], threshold: thresholds[id] });
    return {
      id,
      value: values[id],
      threshold: thresholds[id],
      ...evaluated,
    };
  });

  return { generatedAt: now.toISOString(), metrics, alerts };
}

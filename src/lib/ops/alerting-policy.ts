/** §12 leading metrics. Surfaces must exist even when no baseline is set. */
export const LEADING_METRIC_IDS = [
  'schools_by_mode',
  'active_connections',
  'partner_applications_in_flight',
  'milestone_throughput',
  'request_acceptance_rate',
  'request_acceptance_latency',
  'inbox_depth',
  'dead_letter_rate',
  'reconciliation_drift_incidents',
] as const;

export type LeadingMetricId = (typeof LEADING_METRIC_IDS)[number];

/** Phase 5 named threshold signals. Numbers come from env, never from this file. */
export const THRESHOLD_METRIC_IDS = [
  'inbox_depth',
  'dead_letter_rate',
  'unresolved_quarantine_age',
  'reconciliation_drift_incidents',
] as const;

export type ThresholdMetricId = (typeof THRESHOLD_METRIC_IDS)[number];

export function isOpsAlertingOn(env: string | undefined = process.env.OPS_ALERTING): boolean {
  return env === '1' || env === 'true';
}

export function parseThreshold(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function readConfiguredThresholds(
  env: NodeJS.ProcessEnv = process.env,
): Record<ThresholdMetricId, number | null> {
  return {
    inbox_depth: parseThreshold(env.OPS_ALERT_INBOX_DEPTH),
    dead_letter_rate: parseThreshold(env.OPS_ALERT_DEAD_LETTER_RATE),
    unresolved_quarantine_age: parseThreshold(env.OPS_ALERT_QUARANTINE_AGE_SECONDS),
    reconciliation_drift_incidents: parseThreshold(env.OPS_ALERT_RECONCILIATION_DRIFT),
  };
}

export function evaluateAlert(input: { value: number | null; threshold: number | null }): {
  firing: boolean;
  baseline: 'unmeasured' | 'configured';
} {
  if (input.threshold == null || input.value == null) {
    return { firing: false, baseline: 'unmeasured' };
  }
  return { firing: input.value > input.threshold, baseline: 'configured' };
}

// @polsia:user-owned — zod contract for the admin cleanup-runs surface.
//
// Single source of truth shared between the admin route handler
// (`src/app/api/admin/cleanup-runs/route.ts`) and the client island
// (`src/components/custom/admin/cleanup-runs-table.tsx`). Keeping this
// file client-importable (no server-only deps) is what lets the table
// parse the response with `apiFetch({ schema })` and get a typed result
// instead of an unchecked cast.

import { z } from 'zod';

export const CleanupRunTrigger = z.enum(['cron', 'admin']);
export type CleanupRunTrigger = z.infer<typeof CleanupRunTrigger>;

/** One row on the admin cleanup-runs table. */
export const CleanupRunSummary = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.string().nullable(),
  trigger: CleanupRunTrigger,
  scanned: z.number().int().nullable(),
  deleted: z.number().int().nullable(),
  error: z.string().nullable(),
});
export type CleanupRunSummary = z.infer<typeof CleanupRunSummary>;

export const CleanupRunsList = z.object({
  items: z.array(CleanupRunSummary),
});
export type CleanupRunsList = z.infer<typeof CleanupRunsList>;

/** Reply returned by `POST /api/admin/cleanup-runs` after a manual run. */
export const CleanupRunCreated = z.object({
  runId: z.string(),
  scanned: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
});
export type CleanupRunCreated = z.infer<typeof CleanupRunCreated>;

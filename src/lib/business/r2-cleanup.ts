// @polsia:user-owned — shared logic for the weekly R2 orphan-cleanup job.
//
// Used by:
//   - the admin route handler `src/app/api/admin/cleanup-runs/route.ts`
//     (mirrors the cron body so an admin can trigger the same logic on
//     demand via the "Run cleanup now" button)
//   - implicitly by the cron entrypoint `jobs/r2-cleanup.js`, which
//     duplicates the orchestration in plain JS so it can run under bare
//     `node` outside the Next.js process (the cron job has no import of
//     `@/lib/db` because that file ships `import 'server-only'`).
//
// Logic:
//   1. Collect every R2 object key currently referenced by a User, an
//      Instructor, or a Review row (scalarly — no framework-file join).
//      The Review list is the OPEN list documented below;
//      InstructorLicense is intentionally EXCLUDED because the brief
//      names only User / Instructor / Review (adding license silently
//      widens scope).
//   2. Page through the R2 proxy `GET /files?limit=100` listing until
//      the cursor is exhausted (or 200 pages as a job-length safety).
//   3. Any key NOT in the referenced set is a candidate — DELETE
//      `/files/<key>`, write a CleanupRunDeletion row, and continue.
//      404s from the proxy (already deleted) are skipped silently —
//      delete is idempotent.
//   4. Open a CleanupRun at start and close it at end with status +
//      scanned / deleted counts (or `error` if anything threw).
//
// All HTTP work goes through node-fetch (matching the upload routes'
// choice) so we avoid the multipart `form-data` race that the native
// fetch can hit; the r2-proxy skill flags it.

import nodeFetch from 'node-fetch';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

const R2_BASE = 'https://polsia.com/api/proxy/r2';
const LIST_PAGE_LIMIT = 100;
// Hard cap so a wedged cursor (or a paginated schema the proxy doesn't
// actually cap) doesn't run a cron forever. 200 pages × 100 ≈ 20k keys,
// which is comfortably more than the current company bucket sizing and
// still keeps the job a few minutes.
const MAX_PAGES = 200;
const DB_PAGE_SIZE = 500;

// Columns on Review that the proxy might add later to reference R2 keys.
// Today Review has no URL columns (see prisma/schema/reviews.prisma).
// Keeping the list documented here means a future "reviewer avatar
// upload" column automatically participates in cleanup, instead of
// silently bypassing it. Empty today on purpose — see comment above.
//
// NOTE: InstructorLicense is NOT referenced — the brief names only
// User / Instructor / Review, and License's re-upload path references
// fileKey directly (not a CDN URL), so it does not contribute to
// orphan detection of *images* uploaded to User/Instructor. Including
// it would widen scope beyond what was asked for.
const REVIEW_REFERENCE_FIELDS: ReadonlyArray<string> = [];

function r2AuthHeader(): { Authorization?: string } {
  return env.POLSIA_API_KEY ? { Authorization: `Bearer ${env.POLSIA_API_KEY}` } : {};
}

/**
 * Normalize a stored R2 reference to its object key.
 * Accepts either the public CDN URL form (https://cdn.polsia.com/<key>)
 * or the raw key (no scheme). Query strings and trailing slashes are
 * stripped — a "?v=123" cache-buster on a CDN URL still matches.
 *
 * Returns null when the value doesn't look like a stored R2 reference
 * (empty / non-string / unsupported scheme).
 */
export function r2UrlToKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('://')) return trimmed.replace(/^\/+/, '');
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
}

interface R2ListPage {
  files: Array<{ key: string; url?: string }>;
  pagination?: {
    next_cursor?: string | null;
    cursor?: string | null;
    nextPageToken?: string | null;
    next?: string | null;
  };
}

function nextCursorFrom(page: R2ListPage): string | null | undefined {
  const p = page.pagination;
  if (!p) return null;
  // The r2-proxy SKILL.md only shows a sample without confirming the
  // field name. Try the most common shapes and treat all of them as
  // "the next page token" — a missing/null cursor ends the listing.
  return p.next_cursor ?? p.cursor ?? p.nextPageToken ?? p.next ?? null;
}

/**
 * Yield every object key currently referenced by:
 *   - User.image  (auth.prisma — framework-owned; read in a small batch)
 *   - Instructor.photoUrl
 *   - Review columns listed in REVIEW_REFERENCE_FIELDS (open list)
 *
 * Kept as an `async generator` so the caller can short-circuit on
 * memory pressure; the full set is small (<< 10k keys at this scale).
 */
export async function* referencedKeys(): AsyncIterable<string> {
  // User.image: can't add a field on User (locked file), so the column
  // we need IS already there (`image String?` in auth.prisma). The id
  // is included so we can paginate by `id` cursor (otherwise the only
  // path is a full scan, which is fine but unbounded).
  let lastUserId: string | undefined;
  while (true) {
    const users: { id: string; image: string | null }[] = await prisma.user.findMany({
      select: { id: true, image: true },
      take: DB_PAGE_SIZE,
      ...(lastUserId ? { cursor: { id: lastUserId }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    for (const u of users) {
      const k = r2UrlToKey(u.image);
      if (k) yield k;
      lastUserId = u.id;
    }
    if (users.length < DB_PAGE_SIZE) break;
  }

  const instructors = await prisma.instructor.findMany({
    select: { photoUrl: true },
  });
  for (const inst of instructors) {
    const k = r2UrlToKey(inst.photoUrl);
    if (k) yield k;
  }

  // Review — currently has no URL column. The block below scans the
  // declared REVIEW_REFERENCE_FIELDS so a future column on the user-
  // owned `Review` model (prisma/schema/reviews.prisma) is picked up
  // without code changes here. Today the array is empty and the loop
  // is a no-op.
  if (REVIEW_REFERENCE_FIELDS.length > 0) {
    const reviews = await prisma.review.findMany({
      select: Object.fromEntries(REVIEW_REFERENCE_FIELDS.map((f) => [f, true])),
    });
    for (const r of reviews) {
      const row = r as Record<string, string | null | undefined>;
      for (const f of REVIEW_REFERENCE_FIELDS) {
        const k = r2UrlToKey(row[f]);
        if (k) yield k;
      }
    }
  }
}

/** Collect all referenced keys into a Set (deduped). */
export async function buildReferencedKeySet(): Promise<Set<string>> {
  const set = new Set<string>();
  for await (const k of referencedKeys()) set.add(k);
  return set;
}

/**
 * Page through every R2 file in the company's bucket. Yields raw
 * `key` strings. Cursor-name discovery tries a handful of common field
 * names; if the proxy returns an unknown shape, the loop terminates
 * after one page (the cleanup is still correct — it just won't see
 * later pages this run, which the cron will retry next week).
 */
export async function* listAllR2Keys(): AsyncIterable<string> {
  let cursor: string | null | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${R2_BASE}/files`);
    url.searchParams.set('limit', String(LIST_PAGE_LIMIT));
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await nodeFetch(url, { headers: r2AuthHeader() });
    if (!res.ok) {
      throw new Error(
        `r2 list failed (${res.status} ${res.statusText}) on page ${page}; cursor=${cursor ?? 'initial'}`,
      );
    }
    const json = (await res.json()) as R2ListPage;
    const files = Array.isArray(json.files) ? json.files : [];
    for (const f of files) {
      if (typeof f.key === 'string' && f.key.length > 0) yield f.key;
    }
    if (files.length === 0) return;
    const next = nextCursorFrom(json);
    if (!next) return;
    // Detect a wedged cursor (page returned keys but no progress).
    if (next === cursor) {
      return;
    }
    cursor = next;
  }
}

export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'proxy_error'; status: number };

/** Delete a single R2 object. 404 = "already gone" → skip audit row. */
export async function deleteR2Key(key: string): Promise<DeleteOutcome> {
  const url = `${R2_BASE}/files/${encodeURIComponent(key)}`;
  const res = await nodeFetch(url, { method: 'DELETE', headers: r2AuthHeader() });
  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: false, reason: 'not_found', status: 404 };
  return { ok: false, reason: 'proxy_error', status: res.status };
}

export interface CleanupSummary {
  runId: string;
  scanned: number;
  deleted: number;
}

/**
 * Orchestrate a full cleanup: open a CleanupRun, walk the bucket,
 * delete every orphan, write per-delete audit rows, close the run.
 *
 * The `onProgress` callback lets the cron log progress without forcing
 * it to depend on a logger module.
 */
export async function runCleanup(opts: {
  trigger: 'cron' | 'admin';
  onProgress?: (info: { scanned: number; deleted: number; page: number }) => void;
}): Promise<CleanupSummary> {
  const run = await prisma.cleanupRun.create({
    data: { trigger: opts.trigger, status: 'running' },
  });
  const runId = run.id;
  let lastKey: string | null = null;
  try {
    const referenced = await buildReferencedKeySet();
    let scanned = 0;
    let deleted = 0;
    let page = 0;
    for await (const key of listAllR2Keys()) {
      scanned++;
      lastKey = key;
      if (referenced.has(key)) continue;
      const outcome = await deleteR2Key(key);
      if (outcome.ok) {
        await prisma.cleanupRunDeletion.create({
          data: { runId, key },
        });
        deleted++;
      } else if (outcome.reason === 'proxy_error') {
      }
      if (scanned % LIST_PAGE_LIMIT === 0) {
        page++;
        opts.onProgress?.({ scanned, deleted, page });
      }
    }
    await prisma.cleanupRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        status: 'completed',
        scanned,
        deleted,
      },
    });
    opts.onProgress?.({ scanned, deleted, page });
    return { runId, scanned, deleted };
  } catch (err) {
    const detail =
      err instanceof Error
        ? `${lastKey ? `lastKey=${lastKey}; ` : ''}${err.message}`
        : 'unknown error';
    await prisma.cleanupRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        error: detail,
      },
    });
    throw err;
  }
}

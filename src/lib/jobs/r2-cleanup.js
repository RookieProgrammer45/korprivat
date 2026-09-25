// jobs/r2-cleanup.js — weekly R2 orphan cleanup.
//
// Runs under plain `node` (NOT via Next.js). The deploy platform picks
// this up via the [[crons]] block in polsia.toml:
//   schedule = "0 3 * * 0"   (Sunday 03:00 UTC)
//   command  = "node jobs/r2-cleanup.js"
//
// Reflection of `src/lib/business/r2-cleanup.ts` — the TS module is the
// route-handler path (admin "Run cleanup now" button); this file is the
// cron path. They share semantics but the cron ships outside Next.js
// and CANNOT import `@/lib/db` (`import 'server-only'` would throw under
// bare node), so it owns its own PrismaClient + tone-matched logic.

const { PrismaClient } = require('@prisma/client');
const nodeFetch = require('node-fetch').default || require('node-fetch');

const R2_BASE = 'https://polsia.com/api/proxy/r2';
const LIST_PAGE_LIMIT = 100;
const MAX_PAGES = 200;
const DB_PAGE_SIZE = 500;

// Mirrors `REVIEW_REFERENCE_FIELDS` in src/lib/business/r2-cleanup.ts —
// keep the two lists in sync so a column added on the user-owned
// Review model is picked up by BOTH paths.
//
// Columns of `Review` that might carry an R2 reference URL. Today
// Review has no URL column (see prisma/schema/reviews.prisma). Kept
// open so a future reviewer-avatar field participates in orphan
// detection without changes here.
//
// NOTE: InstructorLicense is intentionally NOT referenced — the brief
// lists only User / Instructor / Review, and License.fileUrl is set
// alongside License.fileKey (URL form). Including it would silently
// widen scope.
const REVIEW_REFERENCE_FIELDS = [];

function r2AuthHeader() {
  return process.env.POLSIA_API_KEY
    ? { Authorization: `Bearer ${process.env.POLSIA_API_KEY}` }
    : {};
}

function r2UrlToKey(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!trimmed.includes('://')) return trimmed.replace(/^\/+/, '');
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const path = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    return path || null;
  } catch {
    return null;
  }
}

async function* referencedKeys(prisma) {
  // User.image — paginated by `id` to avoid an unbounded full table
  // scan; `image` is the framework-owned column on User.
  let lastUserId;
  while (true) {
    const users = await prisma.user.findMany({
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

  const instructors = await prisma.instructor.findMany({ select: { photoUrl: true } });
  for (const inst of instructors) {
    const k = r2UrlToKey(inst.photoUrl);
    if (k) yield k;
  }

  if (REVIEW_REFERENCE_FIELDS.length > 0) {
    const select = Object.fromEntries(REVIEW_REFERENCE_FIELDS.map((f) => [f, true]));
    const reviews = await prisma.review.findMany({ select });
    for (const r of reviews) {
      for (const f of REVIEW_REFERENCE_FIELDS) {
        const k = r2UrlToKey(r[f]);
        if (k) yield k;
      }
    }
  }
}

function nextCursorFrom(page) {
  const p = page?.pagination;
  if (!p) return null;
  return p.next_cursor ?? p.cursor ?? p.nextPageToken ?? p.next ?? null;
}

async function* listAllR2Keys() {
  let cursor;
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
    const json = await res.json();
    const files = Array.isArray(json.files) ? json.files : [];
    for (const f of files) {
      if (typeof f.key === 'string' && f.key.length > 0) yield f.key;
    }
    if (files.length === 0) return;
    const next = nextCursorFrom(json);
    if (!next) return;
    if (next === cursor) {
      return;
    }
    cursor = next;
  }
}

async function deleteR2Key(key) {
  const res = await nodeFetch(`${R2_BASE}/files/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: r2AuthHeader(),
  });
  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: false, reason: 'not_found', status: 404 };
  return { ok: false, reason: 'proxy_error', status: res.status };
}

async function buildReferencedKeySet(prisma) {
  const set = new Set();
  for await (const k of referencedKeys(prisma)) set.add(k);
  return set;
}

function logProgress(_label, _info) {}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for jobs/r2-cleanup.js');
  }

  const prisma = new PrismaClient({ log: ['error', 'warn'] });
  process.on('uncaughtException', (_err) => {});

  const run = await prisma.cleanupRun.create({
    data: { trigger: 'cron', status: 'running' },
  });
  const runId = run.id;
  logProgress('run opened', { scanned: 0, deleted: 0, page: 0 });

  // Hoisted so the catch / after-finally blocks can read the totals
  // for the run-complete log line. Initialised with `deleted=0` so the
  // line below it always has SOMETHING to print even if we threw before
  // scanning anything.
  let summary = { runId, scanned: 0, deleted: 0 };
  let lastKey = null;
  try {
    const referenced = await buildReferencedKeySet(prisma);
    let scanned = 0;
    let deleted = 0;
    let page = 0;

    for await (const key of listAllR2Keys()) {
      scanned++;
      lastKey = key;
      if (referenced.has(key)) continue;
      const outcome = await deleteR2Key(key);
      if (outcome.ok) {
        await prisma.cleanupRunDeletion.create({ data: { runId, key } });
        deleted++;
      }
      if (outcome.reason === 'proxy_error') {
      }
      if (scanned % LIST_PAGE_LIMIT === 0) {
        page++;
        logProgress('progress', { scanned, deleted, page });
      }
    }

    await prisma.cleanupRun.update({
      where: { id: runId },
      data: { finishedAt: new Date(), status: 'completed', scanned, deleted },
    });
    summary = { runId, scanned, deleted };
  } catch (err) {
    const detail =
      err instanceof Error
        ? `${lastKey ? `lastKey=${lastKey}; ` : ''}${err.message}`
        : 'unknown error';
    try {
      await prisma.cleanupRun.update({
        where: { id: runId },
        data: { finishedAt: new Date(), status: 'failed', error: detail },
      });
    } catch (_writeErr) {}
    logProgress('run failed', { scanned: 0, deleted: 0, page: 0 });
    await prisma.$disconnect();
    throw err;
  }
  await prisma.$disconnect();

  logProgress('run complete', {
    scanned: summary.scanned,
    deleted: summary.deleted,
    page: 0,
  });
}

main()
  .then(() => process.exit(0))
  .catch((_err) => {
    process.exit(1);
  });

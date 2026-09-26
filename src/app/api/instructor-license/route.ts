// @polsia:user-owned — POST /api/instructor-license (multipart upload)
//                      GET  /api/instructor-license (current status)
//
// The wizard on /signup drops the instructor at this endpoint after the
// licence-step form submits; the InstructorLicenseStatusBanner island on
// /dashboard/instructor GETs to render the right empty state (pending
// review / rejected / verified).
//
// POST layout (top-down):
//   1. requireAuth — 401 when no session.
//   2. role gate — reject STUDENT with 403 (HANDLEDARE and INSTRUCTOR
//      admitted; the HANDLEDARE path is the new handledare→trafiklärare
//      upgrade upload; INSTRUCTOR keeps the existing wizard re-upload
//      behaviour).
//   3. parse multipart/form-data — 400 with { errors: { license } }.
//   4. validate MIME (image/* or application/pdf) + size (≤20 MB image /
//      ≤50 MB PDF) + `attestation` boolean === true — 400 with same shape.
//   5. stream to R2 via the form-data / node-fetch pipeline mirroring
//      src/app/api/profile/picture/route.ts:103-127.
//   6. upsert the InstructorLicense row keyed by `user.id` — same-row
//      re-upload gates the row to one per user.
//   7. return { status: 'PENDING', fileUrl, submittedAt }.
//
// GET layout:
//   1. requireAuth — 401 when no session.
//   2. InstructorLicense.findUnique({ where: { userId } }) — returns
//      `{ status: 'NONE', ... }` when no row exists.
//   3. UserProfile.findUnique({ where: { userId } }) — projects
//      `canUpgrade: role === 'HANDLEDARE'`. The handledare dashboard
//      upgrade island reads this to know whether to show the upload CTA.
//   4. return the parsed status (plus rejectionReason / submittedAt when
//      a row exists).

import 'server-only';
import { NextResponse } from 'next/server';
import { ObjectStorageError, storeUserUpload } from '@/lib/business/object-storage';
import { LicenseStatusResponse, LicenseUploadResponse } from '@/lib/contracts/instructor-license';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function fileIsAccepted(
  mimeType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; reason: string } {
  if (mimeType.startsWith('image/')) {
    if (sizeBytes > MAX_IMAGE_BYTES) return { ok: false, reason: 'licenseTooLarge' };
    return { ok: true };
  }
  if (mimeType === 'application/pdf') {
    if (sizeBytes > MAX_PDF_BYTES) return { ok: false, reason: 'licenseTooLarge' };
    return { ok: true };
  }
  return { ok: false, reason: 'licenseWrongType' };
}

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Role gate — only HANDLEDARE (starting the upgrade flow) and
  // INSTRUCTOR (re-upload after rejection / initial onboarding) may upload.
  // STUDENT is the cohort whose prior handledare activity is the only
  // thing that should legitimately turn into an upgrade window — a STUDENT
  // never uploads a trafiklärare certificate, so reject explicitly. (The
  // signup wizard's INSTRUCTOR path uses this endpoint too, so INSTRUCTOR
  // is the long-tail re-upload case.)
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (!profile || profile.role === 'STUDENT') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 3. Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { errors: { license: 'Could not read the uploaded file' } },
      { status: 400 },
    );
  }
  const fileEntry = form.get('license');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ errors: { license: 'licenseMissing' } }, { status: 400 });
  }
  const attestation = form.get('attestation');
  if (attestation !== 'true') {
    return NextResponse.json({ errors: { license: 'attestationRequired' } }, { status: 400 });
  }

  // 3. Validate MIME + size.
  const accepted = fileIsAccepted(fileEntry.type, fileEntry.size);
  if (!accepted.ok) {
    return NextResponse.json({ errors: { license: accepted.reason } }, { status: 400 });
  }

  // 4. Store via Vercel Blob (or legacy Polsia R2 when configured).
  let fileKey: string;
  let fileUrl: string;
  try {
    const stored = await storeUserUpload(fileEntry, {
      folder: 'licenses',
      contentType: fileEntry.type,
      filename: fileEntry.name || 'licence',
    });
    fileKey = stored.key;
    fileUrl = stored.url;
  } catch (error) {
    const message = error instanceof ObjectStorageError ? error.message : 'upload_failed';
    return NextResponse.json({ error: 'upload_failed', message }, { status: 502 });
  }

  const submittedAt = new Date();

  // 5. Persist. Upsert on `userId @unique` — every re-upload from the
  // dashboard (after a REJECTED outcome) writes the SAME row and resets
  // status to PENDING.
  try {
    await prisma.instructorLicense.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fileKey,
        fileUrl,
        fileMime: fileEntry.type,
        fileSizeBytes: fileEntry.size,
        attestation: true,
        status: 'PENDING',
        submittedAt,
        // Re-upload resets any prior review decision so admin re-checks.
        rejectionReason: null,
        verifiedAt: null,
        verifiedByEmail: null,
      },
      update: {
        fileKey,
        fileUrl,
        fileMime: fileEntry.type,
        fileSizeBytes: fileEntry.size,
        attestation: true,
        status: 'PENDING',
        submittedAt,
        rejectionReason: null,
        verifiedAt: null,
        verifiedByEmail: null,
      },
    });
  } catch (_err) {
    return NextResponse.json({ error: 'db_failed' }, { status: 500 });
  }

  return NextResponse.json(
    LicenseUploadResponse.parse({
      status: 'PENDING',
      fileUrl,
      submittedAt: submittedAt.toISOString(),
    }),
    { status: 201 },
  );
}

export async function GET(_req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(_req);
  } catch (res) {
    if (res instanceof Response) return res;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [profile, row] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { role: true },
    }),
    prisma.instructorLicense.findUnique({
      where: { userId: user.id },
      select: { status: true, rejectionReason: true, submittedAt: true },
    }),
  ]);
  // HANDLEDARE-only upgrade CTA flag. STUDENT and INSTRUCTOR both get
  // false so the dashboard doesn't offer an upgrade the route would 403.
  const canUpgrade = profile?.role === 'HANDLEDARE';

  return NextResponse.json(
    LicenseStatusResponse.parse(
      row
        ? {
            status: row.status,
            rejectionReason: row.rejectionReason ?? undefined,
            submittedAt: row.submittedAt.toISOString(),
            canUpgrade,
          }
        : { status: 'NONE', canUpgrade },
    ),
  );
}

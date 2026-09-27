//
// Signed-in multipart upload for the instructor self-onboarding form's profile
// picture. It does not persist anything until the detail form creates the
// Instructor row, so an abandoned two-step flow can leave an orphaned object.
//
// The response is `{ imageUrl }`; the detail form puts that URL into the
// existing Instructor.photoUrl field on its subsequent JSON POST.
//
// The handler is `POST` only — there is no GET. A "list uploaded photos"
// endpoint would expose PII by URL, so the deliberately-narrow route shape
// is the safer default; if admin reviewing later needs one, gate it with
// `requireAdmin()` under a different path.

import 'server-only';
import { NextResponse } from 'next/server';
import { PhotoUploadError, stagePhoto, validatePhoto } from '@/lib/business/photo-verification';
import { PhotoUploadResponse } from '@/lib/contracts/photo-verification';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'INSTRUCTOR' && profile?.role !== 'HANDLEDARE') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'malformed_multipart', message: 'Could not read the uploaded file' } },
      { status: 400 },
    );
  }
  const fileEntry = form.get('photo');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: { code: 'malformed_multipart', message: 'No file was uploaded' } },
      { status: 400 },
    );
  }

  const validation = validatePhoto(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ errors: { photo: validation.code } }, { status: 400 });
  }

  try {
    const staged = await stagePhoto(user.id, fileEntry);
    return NextResponse.json(
      PhotoUploadResponse.parse({
        imageUrl: staged.imageUrl,
        stagedAt: staged.stagedAt.toISOString(),
        status: 'STAGED',
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: { code: 'upload_failed', message: 'Upload failed' } },
      { status: 502 },
    );
  }
}

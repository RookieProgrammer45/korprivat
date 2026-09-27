//
// Real avatar upload. Decoupled from signup: the welcome email is fired
// exactly once from /api/auth/welcome immediately after signUp.email
// resolves (race-safe via UserProfile.welcomeSentAt in
// completeSignupHandshake), so this route no longer touches welcomeSentAt
// or sends the welcome email. A re-upload overwrites `image` and re-stamps
// `profileCompletedAt` — both idempotent.
//
// Layout (top-down):
//   1. requireAuth — 401 Response when no session
//   2. parse multipart/form-data — 400 on missing/invalid body
//   3. validate image MIME + ≤20 MB — 400 with { errors: { picture } }
//   4. R2 upload — 502 on proxy failure
//   5. user.update image + userProfile.upsert profileCompletedAt — 500 on db boom
//
// return: 201 { imageUrl, profileCompletedAt: ISO }.

import 'server-only';
import { NextResponse } from 'next/server';
import { PhotoUploadError, stagePhoto, validatePhoto } from '@/lib/business/photo-verification';
import { PhotoUploadResponse } from '@/lib/contracts/photo-verification';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1. Auth.
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { errors: { picture: 'Could not read the uploaded file' } },
      { status: 400 },
    );
  }
  const fileEntry = form.get('file');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ errors: { picture: 'No file was uploaded' } }, { status: 400 });
  }

  const validation = validatePhoto(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ errors: { picture: validation.code } }, { status: 400 });
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
        { status: error.code === 'upload_failed' || error.code === 'db_failed' ? 502 : 400 },
      );
    }
    return NextResponse.json(
      { error: { code: 'db_failed', message: 'Could not stage photo' } },
      { status: 500 },
    );
  }
}

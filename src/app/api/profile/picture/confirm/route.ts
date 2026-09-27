import 'server-only';
import { NextResponse } from 'next/server';
import { confirmPhoto, PhotoUploadError } from '@/lib/business/photo-verification';
import { PhotoConfirmationResponse } from '@/lib/contracts/photo-verification';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  try {
    const confirmed = await confirmPhoto(user.id);
    return NextResponse.json(
      PhotoConfirmationResponse.parse({
        imageUrl: confirmed.imageUrl,
        confirmedAt: confirmed.confirmedAt.toISOString(),
        profileCompletedAt: confirmed.profileCompletedAt.toISOString(),
        status: 'CONFIRMED',
      }),
    );
  } catch (error) {
    if (error instanceof PhotoUploadError && error.code === 'photo_not_staged') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: 'confirmation_failed', message: 'Could not confirm photo' } },
      { status: 500 },
    );
  }
}

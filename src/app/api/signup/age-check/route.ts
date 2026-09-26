// @polsia:user-owned — POST /api/signup/age-check (Didit facial age estimation).
import 'server-only';
import { NextResponse } from 'next/server';
import { AgeCheckResponse } from '@/lib/contracts/didit-age';
import {
  DiditAgeError,
  estimateLearnerAge,
  isDiditAgeConfigured,
  validateFaceImage,
} from '@/lib/didit/age-estimation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isDiditAgeConfigured()) {
    return NextResponse.json(
      AgeCheckResponse.parse({
        eligible: false,
        status: 'Unavailable',
        estimatedAge: null,
        requestId: null,
        warnings: ['Didit age check is not configured'],
      }),
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ errors: { face: 'Could not read the uploaded file' } }, { status: 400 });
  }
  const fileEntry = form.get('face');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ errors: { face: 'No face image was uploaded' } }, { status: 400 });
  }
  const validation = validateFaceImage(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ errors: { face: validation.code } }, { status: 400 });
  }

  const vendorData = typeof form.get('vendorData') === 'string' ? String(form.get('vendorData')) : undefined;

  try {
    const result = await estimateLearnerAge(fileEntry, vendorData);
    return NextResponse.json(
      AgeCheckResponse.parse({
        eligible: result.eligible,
        status: result.status,
        estimatedAge: result.estimatedAge,
        requestId: result.requestId,
        warnings: result.warnings,
      }),
      { status: result.eligible ? 200 : 422 },
    );
  } catch (error) {
    if (error instanceof DiditAgeError) {
      return NextResponse.json(
        { errors: { face: error.code }, message: error.message },
        { status: error.code === 'unauthorized' || error.code === 'credits' ? 502 : 400 },
      );
    }
    return NextResponse.json({ errors: { face: 'request_failed' } }, { status: 502 });
  }
}

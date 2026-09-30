// Legacy POST /api/bookings/[id]/complete — instructor-only "mark delivered".
// Buyers must use POST /confirm. Prefer /deliver for new clients.

import 'server-only';
import { NextResponse } from 'next/server';
import { BookingCompleteRequest } from '@/lib/contracts/bookings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingCompleteRequest.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  // Rewrite to deliver payload and delegate.
  const deliverBody = {
    token: parsed.data.token,
    deliveredByLabel: parsed.data.completedByLabel,
  };
  const { POST: deliverPOST } = await import('@/app/api/bookings/[id]/deliver/route');
  const deliverReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(deliverBody),
  });
  return deliverPOST(deliverReq, ctx);
}

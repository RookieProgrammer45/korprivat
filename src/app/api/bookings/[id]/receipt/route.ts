// @polsia:user-owned — private learner/instructor receipt read endpoint.
import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthorizedBookingReceipt } from '@/lib/business/receipt-pdf';
import { receiptResponse } from '@/lib/business/receipts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await getAuthorizedBookingReceipt(req, id);
  if (result.kind === 'unauthenticated') {
    return NextResponse.json({ errors: { access: 'Authentication is required' } }, { status: 401 });
  }
  if (result.kind === 'booking_not_found') {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  if (result.kind === 'forbidden') {
    return NextResponse.json(
      { errors: { access: 'Receipt access is invalid or expired' } },
      { status: 403 },
    );
  }
  if (result.kind === 'unavailable') {
    return NextResponse.json(
      { errors: { receipt: 'Receipt is not available for this booking' } },
      { status: 404 },
    );
  }
  if (result.kind === 'receipt_not_found') {
    return NextResponse.json({ errors: { receipt: 'Receipt not found' } }, { status: 404 });
  }
  return NextResponse.json(receiptResponse(result.receipt), { status: 200 });
}

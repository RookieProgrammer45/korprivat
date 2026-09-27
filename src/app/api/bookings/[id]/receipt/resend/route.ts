import 'server-only';
import { NextResponse } from 'next/server';
import { deliverBookingReceipt } from '@/lib/business/receipt-delivery';
import { getAuthorizedBookingReceipt } from '@/lib/business/receipt-pdf';
import { ReceiptResendResponse } from '@/lib/contracts/receipts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const authorized = await getAuthorizedBookingReceipt(req, id);
  if (authorized.kind === 'unauthenticated') {
    return NextResponse.json({ errors: { access: 'Authentication is required' } }, { status: 401 });
  }
  if (authorized.kind === 'booking_not_found') {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  if (authorized.kind === 'forbidden') {
    return NextResponse.json(
      { errors: { access: 'Receipt access is invalid or expired' } },
      { status: 403 },
    );
  }
  if (authorized.kind === 'unavailable') {
    return NextResponse.json(
      { errors: { receipt: 'Receipt is not available for this booking' } },
      { status: 404 },
    );
  }
  if (authorized.kind === 'receipt_not_found') {
    return NextResponse.json({ errors: { receipt: 'Receipt not found' } }, { status: 404 });
  }

  const result = await deliverBookingReceipt({
    bookingId: id,
    recipientRole: authorized.recipientRole,
    req,
  });
  return NextResponse.json(
    ReceiptResendResponse.parse({
      emailDeliveryStatus: result.status,
      attempted: result.attempted,
    }),
    { status: 200 },
  );
}

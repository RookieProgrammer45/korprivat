import 'server-only';
import {
  buildReceiptPdfSpec,
  getAuthorizedBookingReceipt,
  receiptPdfFileName,
} from '@/lib/business/receipt-pdf';
import { renderDocumentPdf } from '@/lib/pdf/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await getAuthorizedBookingReceipt(req, id);
  if (result.kind === 'unauthenticated') {
    return Response.json({ errors: { access: 'Authentication is required' } }, { status: 401 });
  }
  if (result.kind === 'booking_not_found') {
    return Response.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  if (result.kind === 'forbidden') {
    return Response.json(
      { errors: { access: 'Receipt access is invalid or expired' } },
      { status: 403 },
    );
  }
  if (result.kind === 'unavailable') {
    return Response.json(
      { errors: { receipt: 'Receipt is not available for this booking' } },
      { status: 404 },
    );
  }
  if (result.kind === 'receipt_not_found') {
    return Response.json({ errors: { receipt: 'Receipt not found' } }, { status: 404 });
  }

  const pdf = await renderDocumentPdf(buildReceiptPdfSpec(result.receipt));
  const fileName = receiptPdfFileName(result.receipt.receiptNumber);
  return new Response(pdf, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'application/pdf',
    },
  });
}

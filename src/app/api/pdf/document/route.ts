// @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/pdf@0.1.0. Drift = commit rejected.
//
// POST /api/pdf/document
// Generates a PDF from a validated DocumentSpec in the request body and streams
// it back as application/pdf.
//
// SECURITY: this route renders a PDF from arbitrary caller input. It is NOT an
// authorization boundary by itself. In production it MUST be gated behind an
// authenticated session / authorization check (e.g. verify the caller may
// generate this document) before it is exposed. Add that check in app-owned
// code; do not treat this route as safe to expose unauthenticated.

import 'server-only';
import { NextResponse } from 'next/server';
import { renderDocumentPdf } from '@/lib/pdf/client';
import { documentSpecSchema } from '@/lib/pdf/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = documentSpecSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_document_spec', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const bytes = await renderDocumentPdf(parsed.data);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="document.pdf"',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'pdf_generation_failed' }, { status: 500 });
  }
}

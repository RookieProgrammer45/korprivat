import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { connectivityDisabled } from '@/lib/connectivity/http';
import { recordProductionAttempt } from '@/lib/connectivity/partner-gateway';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  evidenceSource: z.enum(['mock', 'vendor_environment']),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const disabled = connectivityDisabled();
  if (disabled) return disabled;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Admin session required.', retryable: false } },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: { code: 'invalid_body', message: 'Evidence payload is invalid.', retryable: false },
      },
      { status: 422 },
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: 'invalid_body', message: 'Evidence payload is invalid.', retryable: false },
      },
      { status: 422 },
    );
  }
  const result = await recordProductionAttempt({
    connectionId: id,
    evidenceSource: parsed.data.evidenceSource,
  });
  return NextResponse.json(result.body, { status: result.status });
}

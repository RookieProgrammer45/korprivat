import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TEACHING_CATEGORIES } from '@/lib/acquisition/claim-policy';
import { isConciergeOnboardingOn } from '@/lib/acquisition/concierge-policy';
import {
  approveConciergeDraft,
  correctConciergeDraft,
  publishConciergeDraft,
} from '@/lib/acquisition/concierge-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('publish') }),
  z.object({
    action: z.literal('correct'),
    payload: z.object({
      legalName: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(80),
      categories: z.array(z.enum(TEACHING_CATEGORIES)).min(1),
      policyTier: z.enum(['flexible', 'moderate', 'strict']).nullable().optional(),
    }),
  }),
]);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; draftId: string }> },
) {
  if (!isConciergeOnboardingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const { id, draftId } = await ctx.params;
  const result =
    parsed.data.action === 'approve'
      ? await approveConciergeDraft({ listingId: id, draftId, userId: user.id })
      : parsed.data.action === 'publish'
        ? await publishConciergeDraft({ listingId: id, draftId, userId: user.id })
        : await correctConciergeDraft({
            listingId: id,
            draftId,
            userId: user.id,
            payload: parsed.data.payload,
          });
  return NextResponse.json(result.body, { status: result.status });
}

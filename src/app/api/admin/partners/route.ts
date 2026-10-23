import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  orgNumber: z.string().trim().min(1).max(40),
  country: z.string().trim().length(2),
});

async function isAdmin(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.role === 'admin';
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  const partners = (
    prisma as unknown as {
      partner?: { findMany: (args: unknown) => Promise<unknown[]> };
    }
  ).partner;
  const rows = partners ? await partners.findMany({ orderBy: { createdAt: 'desc' } }) : [];
  return NextResponse.json({ partners: rows });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
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
  const partners = (
    prisma as unknown as { partner?: { create: (args: unknown) => Promise<{ id: string }> } }
  ).partner;
  if (!partners) return NextResponse.json({ error: { code: 'not_available' } }, { status: 503 });
  const partner = await partners.create({
    data: { ...parsed.data, country: parsed.data.country.toUpperCase(), status: 'CANDIDATE' },
  });
  return NextResponse.json({ id: partner.id, status: 'CANDIDATE' }, { status: 201 });
}

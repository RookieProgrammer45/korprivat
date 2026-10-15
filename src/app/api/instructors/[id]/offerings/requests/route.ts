//
// Learner "request to book" against an offering — PUBLIC like the contact
// form (no auth; the booking sign-in gate stays scoped to slot bookings).
// Per-IP token bucket caps burst rate, the request row is persisted FIRST,
// then the school and the learner are notified best-effort: email failure
// must never fail the request itself.
import 'server-only';
import { NextResponse } from 'next/server';
import { OfferingRequestCreate, OfferingRequestCreated } from '@/lib/contracts/offerings';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Same burst shape as /api/contact — 5 per IP per minute.
const WINDOW_MS = 60_000;
const LIMIT = 5;
type Bucket = { count: number; windowStartMs: number };
const buckets = new Map<string, Bucket>();

function clientBucketed(ip: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(ip);
  if (!existing || now - existing.windowStartMs > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStartMs: now });
    return { ok: true, retryAfterSec: 0 };
  }
  if (existing.count >= LIMIT) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - existing.windowStartMs)) / 1000);
    return { ok: false, retryAfterSec };
  }
  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'anonymous';
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) {
    return NextResponse.json({ errors: { offeringId: 'Offering not found' } }, { status: 404 });
  }
  const ip = clientIp(req.headers);
  const bucket = clientBucketed(ip);
  if (!bucket.ok) {
    return NextResponse.json(
      { errors: { form: 'Too many requests — please try again later.' } },
      { status: 429, headers: { 'retry-after': String(bucket.retryAfterSec) } },
    );
  }
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid request body.' } }, { status: 400 });
  }
  const parsed = OfferingRequestCreate.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const data = parsed.data;
  const offering = await prisma.offering.findFirst({
    where: { id: data.offeringId, instructorId: id, active: true },
    select: { id: true, name: true, priceSek: true },
  });
  if (!offering) {
    return NextResponse.json({ errors: { offeringId: 'Offering not found' } }, { status: 404 });
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: { id: true, name: true, city: true, email: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { offeringId: 'Offering not found' } }, { status: 404 });
  }
  await prisma.offeringRequest.create({
    data: {
      offeringId: offering.id,
      offeringName: offering.name,
      offeringPriceSek: offering.priceSek,
      instructorId: instructor.id,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      studentPhone: data.studentPhone,
      preferredStart: data.preferredStart || null,
      message: data.message || null,
      locale: data.locale ?? 'sv',
    },
  });
  try {
    const { offeringRequestLearnerEmail, offeringRequestSchoolEmail } = await import(
      '@/lib/email/templates'
    );
    const { sendEmail } = await import('@/lib/email/send');
    if (instructor.email) {
      await sendEmail({
        to: instructor.email,
        ...offeringRequestSchoolEmail({
          schoolName: instructor.name,
          schoolCity: instructor.city,
          offeringName: offering.name,
          offeringPriceSek: offering.priceSek,
          studentName: data.studentName,
          studentEmail: data.studentEmail,
          studentPhone: data.studentPhone,
          preferredStart: data.preferredStart || null,
          message: data.message || null,
          locale: data.locale ?? 'sv',
        }),
      });
    }
    await sendEmail({
      to: data.studentEmail,
      ...offeringRequestLearnerEmail({
        schoolName: instructor.name,
        schoolCity: instructor.city,
        offeringName: offering.name,
        studentName: data.studentName,
        locale: data.locale ?? 'sv',
      }),
    });
  } catch (error) {
    console.error('[offerings/requests] email delivery failed — request kept', error);
  }
  return NextResponse.json(OfferingRequestCreated.parse({ ok: true }), { status: 200 });
}

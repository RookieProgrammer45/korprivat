// @polsia:user-owned
//
// POST /api/waitlist — REST route handler for the DriveLinkUp early-access
// signup. Lives under /api, which proxy.ts's matcher excludes.
//
// Captures name + email + role on the user-owned `WaitlistProfile` table
// (parallel to the module's framework-owned `WaitlistEntry`, which is
// email-only). Idempotent: re-submitting the same email updates the row
// and returns 200; first insert returns 201. The confirmation email fires
// once per first-insert so we don't spam duplicates.
//
// Do NOT add a public GET that lists signups here: the rows contain PII.
// To let the founder VIEW signups, gate that view/route behind the auth
// module's role (install better-auth + use requireAdmin) — never list
// signups on a public route or page. (Only expose them publicly if the
// founder EXPLICITLY asks for one.)

import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { waitlistConfirmationEmail } from '@/lib/email/templates';
import { WaitlistCreate, type WaitlistCreatedValue } from '@/lib/waitlist/schema';

export const dynamic = 'force-dynamic';

interface ErrorBody {
  errors: Record<string, string>;
}

function badRequest(fieldErrors: Record<string, string>): NextResponse<ErrorBody> {
  return NextResponse.json({ errors: fieldErrors }, { status: 400 });
}

export async function POST(req: Request): Promise<NextResponse<WaitlistCreatedValue | ErrorBody>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest({ email: 'Invalid request body.' });
  }

  const parsed = WaitlistCreate.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(flat)) {
      if (messages?.[0]) fieldErrors[key] = messages[0];
    }
    if (Object.keys(fieldErrors).length === 0) {
      fieldErrors.email = 'Invalid input.';
    }
    return badRequest(fieldErrors);
  }
  const { name, email, role } = parsed.data;

  try {
    const existing = await prisma.waitlistProfile.findUnique({ where: { email } });
    const profile = existing
      ? await prisma.waitlistProfile.update({
          where: { email },
          data: { name, role },
        })
      : await prisma.waitlistProfile.create({
          data: { name, email, role },
        });

    if (!existing) {
      // Fire-and-forget confirmation email; do not block the response.
      void sendEmail({
        to: email,
        ...waitlistConfirmationEmail({ name, role }),
      }).catch(() => {
        // Swallow — the proxy returns auth errors in some environments.
        // The row is saved either way; the founder can re-send manually.
      });
    }

    return NextResponse.json(
      { id: profile.id, role: profile.role },
      { status: existing ? 200 : 201 },
    );
  } catch {
    return NextResponse.json(
      { errors: { email: 'Something went wrong. Please try again.' } },
      { status: 500 },
    );
  }
}

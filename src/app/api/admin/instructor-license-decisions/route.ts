//
// Admin-only list of pending InstructorLicense rows for the review table.
// Returns the User's email + name alongside each licence row — User is
// the framework-owned better-auth model and cannot be related via
// @relation, so this endpoint does a by-id batch lookup (Prisma
// `findMany` with `where: { id: { in: userIds } }`) instead of including.
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { InstructorLicenseAdminList } from '@/lib/contracts/instructor-license';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const licenses = await prisma.instructorLicense.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    select: {
      userId: true,
      fileUrl: true,
      fileMime: true,
      fileSizeBytes: true,
      submittedAt: true,
      attestation: true,
    },
  });

  // Join User email/name by id (scalar FK → no Prisma include). Empty
  // list short-circuits the lookup.
  let usersById: Record<string, { email: string; name: string }> = {};
  if (licenses.length > 0) {
    const dbUsers = await prisma.user.findMany({
      where: { id: { in: licenses.map((r) => r.userId) } },
      select: { id: true, email: true, name: true },
    });
    usersById = Object.fromEntries(dbUsers.map((u) => [u.id, { email: u.email, name: u.name }]));
  }

  return NextResponse.json(
    InstructorLicenseAdminList.parse({
      items: licenses.map((row) => {
        const u = usersById[row.userId];
        return {
          userId: row.userId,
          email: u?.email ?? '(unknown)',
          name: u?.name ?? '(unknown)',
          fileUrl: row.fileUrl,
          fileMime: row.fileMime,
          fileSizeBytes: row.fileSizeBytes,
          submittedAt: row.submittedAt.toISOString(),
          attestation: row.attestation,
        };
      }),
    }),
  );
}

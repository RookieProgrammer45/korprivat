import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireAuth,
  mockProfile,
  mockLicense,
  mockInstructorFindMany,
  mockInstructorFindUnique,
  mockInstructorCreate,
  mockAffiliationFind,
  mockInvitationCreate,
  mockInvitationFind,
  mockInvitationUpdate,
  mockAffiliationCreate,
  mockRepresentative,
  mockGrantCreate,
  mockSlotCreate,
  mockResolveOwned,
  mockOfferingCreate,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockProfile: vi.fn(),
  mockLicense: vi.fn(),
  mockInstructorFindMany: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockInstructorCreate: vi.fn(),
  mockAffiliationFind: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockInvitationFind: vi.fn(),
  mockInvitationUpdate: vi.fn(),
  mockAffiliationCreate: vi.fn(),
  mockRepresentative: vi.fn(),
  mockGrantCreate: vi.fn(),
  mockSlotCreate: vi.fn(),
  mockResolveOwned: vi.fn(),
  mockOfferingCreate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/business/provider-ownership', () => ({
  resolveOwnedProvider: mockResolveOwned,
  ProviderOwnershipError: class ProviderOwnershipError extends Error {},
}));
vi.mock('@/lib/business/photo-verification', () => ({ confirmedPhotoUrl: async () => null }));
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mockProfile },
    instructorLicense: { findUnique: mockLicense },
    instructor: {
      findMany: mockInstructorFindMany,
      findUnique: mockInstructorFindUnique,
      create: mockInstructorCreate,
    },
    schoolInstructorAffiliation: { findFirst: mockAffiliationFind, create: mockAffiliationCreate },
    schoolInstructorInvitation: {
      create: mockInvitationCreate,
      findUnique: mockInvitationFind,
      update: mockInvitationUpdate,
    },
    listingRepresentativeAuthority: { findUnique: mockRepresentative },
    schoolAuthorizationEvent: { create: mockGrantCreate },
    availabilitySlot: { create: mockSlotCreate, createMany: vi.fn() },
    offering: { create: mockOfferingCreate, findFirst: vi.fn() },
  },
}));

import { POST as publishAvailability } from '@/app/api/instructor-availability/route';
import { POST as acceptInvite } from '@/app/api/instructor-invitations/[id]/accept/route';
import { POST as publishOffering } from '@/app/api/instructors/me/offerings/route';
import { POST as publishInstructor } from '@/app/api/instructors/route';
import { POST as grantScopes } from '@/app/api/listings/[id]/authorizations/route';
import { POST as invite } from '@/app/api/schools/[id]/instructor-invitations/route';

const instructorBody = {
  name: 'Ada Instructor',
  city: 'Sjöbo',
  categories: ['B'],
  hourlyRateSek: 700,
  bio: 'Synthetic instructor',
  photoUrl: 'https://example.com/photo.jpg',
  email: 'ada@example.com',
};

beforeEach(() => {
  delete process.env.SCHOOL_MEDIATED_INSTRUCTORS;
  mockRequireAuth.mockReset();
  mockProfile.mockReset();
  mockLicense.mockReset();
  mockInstructorFindMany.mockReset();
  mockInstructorFindUnique.mockReset();
  mockInstructorCreate.mockReset();
  mockAffiliationFind.mockReset();
  mockInvitationCreate.mockReset();
  mockRepresentative.mockReset();
  mockGrantCreate.mockReset();
  mockSlotCreate.mockReset();
  mockResolveOwned.mockReset();
  mockOfferingCreate.mockReset();
  mockRequireAuth.mockResolvedValue({ id: 'user_1', email: 'ada@example.com' });
  mockProfile.mockResolvedValue({ role: 'INSTRUCTOR', signupPath: 'INSTRUCTOR' });
  mockLicense.mockResolvedValue({ status: 'VERIFIED' });
  mockInstructorFindMany.mockResolvedValue([]);
  mockAffiliationFind.mockResolvedValue(null);
  mockInvitationFind.mockReset();
  mockInvitationUpdate.mockReset();
  mockAffiliationCreate.mockReset();
});

describe('school-mediated instructor routes', () => {
  it('does not query affiliation while the flag is off', async () => {
    const res = await publishInstructor(
      new Request('http://localhost/api/instructors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(instructorBody),
      }),
    );
    expect(res.status).toBe(409);
    expect(mockAffiliationFind).not.toHaveBeenCalled();
    expect(mockInstructorCreate).not.toHaveBeenCalled();
  });

  it('SC-23 refuses an independent instructor listing, sale, diary, and scope grant', async () => {
    process.env.SCHOOL_MEDIATED_INSTRUCTORS = '1';
    const published = await publishInstructor(
      new Request('http://localhost/api/instructors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(instructorBody),
      }),
    );
    expect(published.status).toBe(403);
    expect(await published.json()).toMatchObject({
      error: { code: 'independent_publication_refused' },
    });
    expect(mockInstructorCreate).not.toHaveBeenCalled();

    mockResolveOwned.mockResolvedValue({
      id: 'inst_1',
      providerRole: 'INSTRUCTOR',
      bookingMode: 'request',
    });
    const offering = await publishOffering(
      new Request('http://localhost/api/instructors/me/offerings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'LEKTION',
          name: 'B lesson',
          priceSek: 700,
          categories: ['C'],
        }),
      }),
    );
    expect(offering.status).toBe(403);
    expect(await offering.json()).toMatchObject({ error: { code: 'independent_sale_refused' } });
    expect(mockOfferingCreate).not.toHaveBeenCalled();

    const diary = await publishAvailability(
      new Request('http://localhost/api/instructor-availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          startsAt: '2026-11-02T09:00:00.000Z',
          endsAt: '2026-11-02T10:00:00.000Z',
          durationMinutes: 60,
        }),
      }),
    );
    expect(diary.status).toBe(403);
    expect(await diary.json()).toMatchObject({ error: { code: 'inventory_not_delegated' } });
    expect(mockSlotCreate).not.toHaveBeenCalled();

    const grant = await grantScopes(
      new Request('http://localhost/api/listings/school_1/authorizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'grant', scopes: ['availability_display'] }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(grant.status).toBe(403);
    expect(await grant.json()).toMatchObject({
      error: { code: 'instructor_role_cannot_grant_scopes' },
    });
    expect(mockGrantCreate).not.toHaveBeenCalled();
    delete process.env.SCHOOL_MEDIATED_INSTRUCTORS;
  });

  it('accepts a school invitation without granting scopes, and refuses a category the school does not hold', async () => {
    const hidden = await invite(
      new Request('http://localhost/api/schools/school_1/instructor-invitations'),
      {
        params: Promise.resolve({ id: 'school_1' }),
      },
    );
    expect(hidden.status).toBe(404);
    expect(mockInstructorFindUnique).not.toHaveBeenCalled();

    process.env.SCHOOL_MEDIATED_INSTRUCTORS = '1';
    mockInstructorFindUnique.mockResolvedValueOnce({
      id: 'school_1',
      providerRole: 'SCHOOL',
      categories: ['B'],
    });
    mockRepresentative.mockResolvedValueOnce({
      userId: 'user_1',
      verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
      evidenceRef: 'rep_1',
    });
    const refused = await invite(
      new Request('http://localhost/api/schools/school_1/instructor-invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ada@example.com',
          teachingCategories: ['C'],
          inventoryDelegated: true,
        }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(refused.status).toBe(403);
    expect(mockInvitationCreate).not.toHaveBeenCalled();
    expect(mockGrantCreate).not.toHaveBeenCalled();

    mockInstructorFindUnique.mockResolvedValueOnce({
      id: 'school_1',
      providerRole: 'SCHOOL',
      categories: ['A', 'B', 'C', 'D'],
    });
    mockRepresentative.mockResolvedValueOnce({
      userId: 'user_1',
      verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
      evidenceRef: 'rep_1',
    });
    mockInvitationCreate.mockResolvedValueOnce({ id: 'invite_1' });
    const created = await invite(
      new Request('http://localhost/api/schools/school_1/instructor-invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ada@example.com',
          teachingCategories: ['C', 'D'],
          inventoryDelegated: false,
        }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ scopesGranted: [], inventoryDelegated: false });

    mockInvitationFind.mockResolvedValueOnce({
      id: 'invite_1',
      email: 'ada@example.com',
      status: 'PENDING',
      schoolListingId: 'school_1',
      teachingCategories: ['C', 'D'],
      inventoryDelegated: false,
    });
    mockAffiliationCreate.mockResolvedValueOnce({ id: 'aff_1' });
    mockInvitationUpdate.mockResolvedValueOnce({ id: 'invite_1' });
    const accepted = await acceptInvite(
      new Request('http://localhost/api/instructor-invitations/invite_1/accept'),
      {
        params: Promise.resolve({ id: 'invite_1' }),
      },
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      schoolListingId: 'school_1',
      scopesGranted: [],
      authorizationEventsCreated: 0,
    });
    expect(mockGrantCreate).not.toHaveBeenCalled();
    delete process.env.SCHOOL_MEDIATED_INSTRUCTORS;
  });
});

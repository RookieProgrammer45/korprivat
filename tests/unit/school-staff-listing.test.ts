import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInstructorFindFirst,
  mockInstructorFindMany,
  mockInstructorCreate,
  mockBindingFindFirst,
  mockMembershipFindMany,
  mockUserFindUnique,
  mockOrgFindUnique,
} = vi.hoisted(() => ({
  mockInstructorFindFirst: vi.fn(),
  mockInstructorFindMany: vi.fn(),
  mockInstructorCreate: vi.fn(),
  mockBindingFindFirst: vi.fn(),
  mockMembershipFindMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockOrgFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: {
      findFirst: mockInstructorFindFirst,
      findMany: mockInstructorFindMany,
      create: mockInstructorCreate,
    },
    listingOrgBinding: { findFirst: mockBindingFindFirst },
    membership: { findMany: mockMembershipFindMany },
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrgFindUnique },
  },
}));

import { publishSchoolStaffListing } from '@/lib/discovery/school-staff-listing';

const schoolListing = {
  id: 'school_listing',
  name: 'Sjöbo Trafikskola',
  city: 'Sjöbo',
  serviceArea: 'Sjöbo + 15 km',
  categories: ['B'],
  hourlyRateSek: 760,
  photoUrl: 'https://example.test/school.jpg',
  englishSpeaking: true,
  latitude: 55.63,
  longitude: 13.7,
  bookingMode: 'contact',
  cancellationPolicyTier: 'flexible',
  providerRole: 'SCHOOL',
};

describe('publishSchoolStaffListing', () => {
  beforeEach(() => {
    mockInstructorFindFirst.mockReset();
    mockInstructorFindMany.mockReset();
    mockInstructorCreate.mockReset();
    mockBindingFindFirst.mockReset();
    mockMembershipFindMany.mockReset();
    mockUserFindUnique.mockReset();
    mockOrgFindUnique.mockReset();
    mockInstructorFindMany.mockResolvedValue([]);
    mockBindingFindFirst.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([{ userId: 'owner_1' }]);
    mockInstructorFindFirst.mockResolvedValue(schoolListing);
    mockUserFindUnique.mockResolvedValue({
      id: 'staff_1',
      name: 'Anna Larsson',
      email: 'anna@example.test',
    });
    mockOrgFindUnique.mockResolvedValue({ id: 'org_1', name: 'Sjöbo Trafikskola' });
    mockInstructorCreate.mockImplementation(async ({ data }: { data: { id: string } }) => data);
  });

  it('creates a catalogue listing from the school listing when the invite is accepted', async () => {
    const result = await publishSchoolStaffListing({
      organizationId: 'org_1',
      userId: 'staff_1',
    });

    expect(result.created).toBe(true);
    expect(mockInstructorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Anna Larsson',
          city: 'Sjöbo',
          categories: ['B'],
          hourlyRateSek: 760,
          userId: 'staff_1',
          providerRole: 'INSTRUCTOR',
          bookingMode: 'contact',
          photoUrl: schoolListing.photoUrl,
          email: 'anna@example.test',
        }),
      }),
    );
  });

  it('does not create a second listing when the instructor already has one', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([{ id: 'existing' }]);
    const result = await publishSchoolStaffListing({
      organizationId: 'org_1',
      userId: 'staff_1',
    });
    expect(result).toEqual({ created: false, listingId: 'existing' });
    expect(mockInstructorCreate).not.toHaveBeenCalled();
  });

  it('skips publish when the school has no listing to inherit', async () => {
    mockInstructorFindFirst.mockResolvedValueOnce(null);
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'org_1',
      name: 'Sjöbo Trafikskola',
      contactEmail: null,
    });
    const result = await publishSchoolStaffListing({
      organizationId: 'org_1',
      userId: 'staff_1',
    });
    expect(result).toEqual({ created: false, listingId: null });
    expect(mockInstructorCreate).not.toHaveBeenCalled();
  });
});

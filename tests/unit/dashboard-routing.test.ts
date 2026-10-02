import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMembershipsForUser } = vi.hoisted(() => ({
  listMembershipsForUser: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/orgs/service', () => ({ listMembershipsForUser }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/db', () => ({ prisma: { userProfile: { findUnique: vi.fn(), create: vi.fn() } } }));

import { dashboardPathFor, resolveDashboardHome } from '@/lib/dashboard-guard';
import { deriveDashboardShellRole } from '@/lib/dashboard-shell-role';

describe('dashboardPathFor', () => {
  it('maps marketplace roles to leaf paths', () => {
    expect(dashboardPathFor('INSTRUCTOR')).toBe('/dashboard/instructor');
    expect(dashboardPathFor('HANDLEDARE')).toBe('/dashboard/handledare');
    expect(dashboardPathFor('STUDENT')).toBe('/dashboard/student');
  });
});

describe('resolveDashboardHome', () => {
  beforeEach(() => {
    listMembershipsForUser.mockReset();
  });

  it('routes OWNER membership to /dashboard/school', async () => {
    listMembershipsForUser.mockResolvedValueOnce([{ role: 'OWNER' }]);
    await expect(resolveDashboardHome('u1', 'STUDENT')).resolves.toBe('/dashboard/school');
  });

  it('routes STAFF membership to /dashboard/school', async () => {
    listMembershipsForUser.mockResolvedValueOnce([{ role: 'STAFF' }]);
    await expect(resolveDashboardHome('u1', 'STUDENT')).resolves.toBe('/dashboard/school');
  });

  it('routes INSTRUCTOR with no membership to /dashboard/instructor', async () => {
    listMembershipsForUser.mockResolvedValueOnce([]);
    await expect(resolveDashboardHome('u1', 'INSTRUCTOR')).resolves.toBe('/dashboard/instructor');
  });

  it('routes HANDLEDARE to /dashboard/handledare', async () => {
    listMembershipsForUser.mockResolvedValueOnce([]);
    await expect(resolveDashboardHome('u1', 'HANDLEDARE')).resolves.toBe('/dashboard/handledare');
  });

  it('routes STUDENT with no membership to /dashboard/student', async () => {
    listMembershipsForUser.mockResolvedValueOnce([]);
    await expect(resolveDashboardHome('u1', 'STUDENT')).resolves.toBe('/dashboard/student');
  });

  it('lets OWNER membership win over INSTRUCTOR profile role', async () => {
    listMembershipsForUser.mockResolvedValueOnce([{ role: 'OWNER' }]);
    await expect(resolveDashboardHome('u1', 'INSTRUCTOR')).resolves.toBe('/dashboard/school');
  });
});

describe('deriveDashboardShellRole', () => {
  it('derives school from membership', () => {
    expect(
      deriveDashboardShellRole({
        isSchoolOwner: true,
        role: 'STUDENT',
        isAdmin: false,
      }),
    ).toBe('school');
  });

  it('derives instructor from INSTRUCTOR without membership', () => {
    expect(
      deriveDashboardShellRole({
        isSchoolOwner: false,
        role: 'INSTRUCTOR',
        isAdmin: false,
      }),
    ).toBe('instructor');
  });

  it('treats HANDLEDARE as instructor chrome', () => {
    expect(
      deriveDashboardShellRole({
        isSchoolOwner: false,
        role: 'HANDLEDARE',
        isAdmin: false,
      }),
    ).toBe('instructor');
  });

  it('derives learner from STUDENT', () => {
    expect(
      deriveDashboardShellRole({
        isSchoolOwner: false,
        role: 'STUDENT',
        isAdmin: false,
      }),
    ).toBe('learner');
  });

  it('derives admin only when not school/provider', () => {
    expect(
      deriveDashboardShellRole({
        isSchoolOwner: false,
        role: 'STUDENT',
        isAdmin: true,
      }),
    ).toBe('admin');
  });
});

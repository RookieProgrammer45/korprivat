import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDashboardNavItems } from '@/lib/dashboard-nav-items';

describe('buildDashboardNavItems', () => {
  it('returns student leaf for learners', () => {
    const items = buildDashboardNavItems({ role: 'STUDENT', isSchoolOwner: false });
    expect(items.map((i) => i.href)).toEqual([
      '/dashboard/student',
      '/dashboard/messages',
    ]);
    expect(items.map((i) => i.labelKey)).toContain('studentTab');
  });

  it('returns instructor leaves without school chrome', () => {
    const items = buildDashboardNavItems({ role: 'INSTRUCTOR', isSchoolOwner: false });
    expect(items.map((i) => i.href)).toEqual([
      '/dashboard',
      '/dashboard/instructor',
      '/dashboard/instructor/availability',
      '/dashboard/instructor/revenue',
      '/dashboard/messages',
    ]);
    expect(items.some((i) => i.labelKey === 'instructorTab')).toBe(true);
    expect(items.some((i) => i.labelKey.startsWith('school'))).toBe(false);
  });

  it('returns school leaves when isSchoolOwner', () => {
    const items = buildDashboardNavItems({ role: 'INSTRUCTOR', isSchoolOwner: true });
    expect(items.map((i) => i.href)).toEqual([
      '/dashboard/school',
      '/dashboard/school#instructors',
      '/dashboard/school#bookings',
      '/dashboard/school/revenue',
      '/dashboard/school/settings',
    ]);
  });
});

describe('instructor chrome copy', () => {
  it('does not label the instructor tab Driving school in EN', () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), 'messages/en.json'), 'utf8'),
    ) as {
      dashboard: { nav: { instructorTab: string }; instructor: { eyebrow: string; title: string } };
    };
    expect(en.dashboard.nav.instructorTab).toBe('Instructor');
    expect(en.dashboard.nav.instructorTab).not.toBe('Driving school');
    expect(en.dashboard.instructor.eyebrow).toBe('Instructor');
    expect(en.dashboard.instructor.title).toBe('Instructor dashboard');
  });
});

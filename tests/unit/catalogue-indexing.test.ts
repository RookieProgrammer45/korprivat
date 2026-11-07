import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructorLicense: { findMany: async () => [], findUnique: async () => null },
    instructor: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
    },
  },
}));

const { catalogueWebsiteDown, listCatalogueSchools, nordicInstructorById } = await import(
  '@/lib/discovery/nordic-catalogue'
);
const { loadPublicInstructorBySchoolSlug } = await import('@/lib/seo/public-instructor');
const { seoRoutes } = await import('@/lib/seo-routes');
const { schoolPath } = await import('@/lib/seo/school-slugs');

const DOWN = 'eues2439dd-autoescuela-liebana';
const UP = 'euese44ca3-k-dos';

function slugOf(id: string): string {
  const school = nordicInstructorById(id);
  if (!school) throw new Error(`missing ${id}`);
  return schoolPath(school).split('/').pop() ?? '';
}

describe('catalogue indexing', () => {
  it('keeps a school whose website is down listed but out of search', async () => {
    expect(nordicInstructorById(DOWN)).not.toBeNull();
    expect(catalogueWebsiteDown(DOWN)).toBe(true);
    expect(catalogueWebsiteDown(UP)).toBe(false);
    expect((await loadPublicInstructorBySchoolSlug(slugOf(DOWN)))?.instructor.indexable).toBe(
      false,
    );
    expect((await loadPublicInstructorBySchoolSlug(slugOf(UP)))?.instructor.indexable).toBe(true);
  });

  it('resolves Canadian and Brazilian school profile slugs from the catalogue', async () => {
    const ca = listCatalogueSchools().find((school) => school.id.startsWith('ca'));
    const br = listCatalogueSchools().find((school) => school.id.startsWith('br'));
    expect(ca).toBeTruthy();
    expect(br).toBeTruthy();
    if (!ca || !br) return;
    expect((await loadPublicInstructorBySchoolSlug(slugOf(ca.id)))?.instructor.id).toBe(ca.id);
    expect((await loadPublicInstructorBySchoolSlug(slugOf(br.id)))?.instructor.id).toBe(br.id);
  });

  it('puts every catalogue school with a live website in the sitemap', async () => {
    const paths = new Set((await seoRoutes()).map((route) => route.path));
    for (const school of listCatalogueSchools()) {
      expect(paths.has(schoolPath(school))).toBe(!catalogueWebsiteDown(school.id));
    }
  });
});

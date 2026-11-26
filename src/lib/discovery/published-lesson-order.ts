/** Cheapest published website lesson first. A missing price sorts last, never a stored rate. */

export function publishedLessonSek(school: {
  publishedPrices?: { lesson?: { priceSek?: number | null } | null } | null;
}): number | null {
  const price = school.publishedPrices?.lesson?.priceSek;
  return typeof price === 'number' && price > 0 ? price : null;
}

export function compareByPublishedLessonPrice<T extends { name: string }>(
  a: T & Parameters<typeof publishedLessonSek>[0],
  b: T & Parameters<typeof publishedLessonSek>[0],
): number {
  const left = publishedLessonSek(a) ?? Number.POSITIVE_INFINITY;
  const right = publishedLessonSek(b) ?? Number.POSITIVE_INFINITY;
  if (left !== right) return left - right;
  return a.name.localeCompare(b.name, 'sv');
}

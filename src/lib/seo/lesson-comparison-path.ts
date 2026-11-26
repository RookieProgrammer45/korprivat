import type { NordicLocation } from '@/lib/seo/nordic-locations';
import { locationPath } from '@/lib/seo/nordic-locations';

/** Crawlable PriceRunner-style comparison URL for published B lessons in a city. */
export const LESSON_COMPARISON_SEGMENT = 'korlektion';

/** A thin comparison page wastes crawl budget; match the city-hub floor. */
export const MIN_PRICED_SCHOOLS_FOR_LESSON_COMPARISON = 3;

export function lessonComparisonPath(location: Pick<NordicLocation, 'country' | 'slug'>): string {
  return `${locationPath(location)}/${LESSON_COMPARISON_SEGMENT}`;
}

export function isLessonComparisonEligible(pricedSchoolCount: number): boolean {
  return pricedSchoolCount >= MIN_PRICED_SCHOOLS_FOR_LESSON_COMPARISON;
}

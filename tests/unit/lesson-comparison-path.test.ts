import { describe, expect, it } from 'vitest';
import {
  isLessonComparisonEligible,
  lessonComparisonPath,
  MIN_PRICED_SCHOOLS_FOR_LESSON_COMPARISON,
} from '@/lib/seo/lesson-comparison-path';

describe('lessonComparisonPath', () => {
  it('builds a crawlable comparison URL under the city hub', () => {
    expect(lessonComparisonPath({ country: 'se', slug: 'goteborg' })).toBe(
      '/locations/se/goteborg/korlektion',
    );
  });

  it('requires enough published website lessons before indexing', () => {
    expect(isLessonComparisonEligible(MIN_PRICED_SCHOOLS_FOR_LESSON_COMPARISON - 1)).toBe(false);
    expect(isLessonComparisonEligible(MIN_PRICED_SCHOOLS_FOR_LESSON_COMPARISON)).toBe(true);
  });
});

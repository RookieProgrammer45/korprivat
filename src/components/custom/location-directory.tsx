'use client';

import { InstructorDirectory } from '@/components/custom/instructor-directory';

/** Client island: directory pre-filtered to a marketplace city name. */
export function LocationDirectory({ cityName }: { cityName: string }) {
  return <InstructorDirectory initialFilters={{ city: cityName }} />;
}

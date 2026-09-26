// @polsia:user-owned — GET /api/signup/capabilities
import 'server-only';
import { NextResponse } from 'next/server';
import { SignupCapabilities } from '@/lib/contracts/didit-age';
import { isDiditAgeConfigured } from '@/lib/didit/age-estimation';
import {
  MIN_INSTRUCTOR_LICENSE_YEARS,
  MIN_LEARNER_AGE_YEARS,
} from '@/lib/signup-eligibility';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    SignupCapabilities.parse({
      diditAgeCheck: isDiditAgeConfigured(),
      minLearnerAgeYears: MIN_LEARNER_AGE_YEARS,
      minInstructorLicenseYears: MIN_INSTRUCTOR_LICENSE_YEARS,
    }),
  );
}

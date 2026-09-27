import 'server-only';
import { NextResponse } from 'next/server';
import { SignupCapabilities } from '@/lib/contracts/didit-age';
import {
  MIN_INSTRUCTOR_LICENSE_YEARS,
  MIN_LEARNER_AGE_YEARS,
} from '@/lib/signup-eligibility';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    SignupCapabilities.parse({
      minLearnerAgeYears: MIN_LEARNER_AGE_YEARS,
      minInstructorLicenseYears: MIN_INSTRUCTOR_LICENSE_YEARS,
    }),
  );
}

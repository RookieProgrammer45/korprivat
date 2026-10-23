import type { BookingCreateDecision } from '@/lib/orgs/school-authorization-policy';

export function isLeadDashboardOn(env: string | undefined = process.env.LEAD_DASHBOARD): boolean {
  return env === '1' || env === 'true';
}

export type LeadPrompt = {
  scope: 'inquiry_collection';
  reason: 'historical_inquiries';
};

export function leadDashboardDecision(input: {
  representativeVerified: boolean;
  grantedScopes: string[];
  historicalInquiryCount: number;
}): {
  visible: boolean;
  bookingSurfaces: false;
  collectNewInquiries: boolean;
  prompts: LeadPrompt[];
  historicalInquiries: number;
} {
  if (!input.representativeVerified) {
    return {
      visible: false,
      bookingSurfaces: false,
      collectNewInquiries: false,
      prompts: [],
      historicalInquiries: 0,
    };
  }
  const granted = new Set(input.grantedScopes);
  const prompts: LeadPrompt[] = [];
  if (input.historicalInquiryCount > 0 && !granted.has('inquiry_collection')) {
    prompts.push({ scope: 'inquiry_collection', reason: 'historical_inquiries' });
  }
  return {
    visible: true,
    bookingSurfaces: false,
    collectNewInquiries: granted.has('inquiry_collection'),
    prompts,
    historicalInquiries: input.historicalInquiryCount,
  };
}

/** A lead never becomes a booking from this surface, and the check never grants a scope. */
export function leadConversionDecision(input: {
  representativeVerified: boolean;
  booking: BookingCreateDecision;
}): {
  status: number;
  scopesGranted: [];
  authorizationEventsCreated: 0;
  bookingCreated: false;
  code: string;
} {
  if (!input.representativeVerified) {
    return {
      status: 403,
      scopesGranted: [],
      authorizationEventsCreated: 0,
      bookingCreated: false,
      code: 'not_representative',
    };
  }
  if (!input.booking.ok) {
    return {
      status: input.booking.status,
      scopesGranted: [],
      authorizationEventsCreated: 0,
      bookingCreated: false,
      code: input.booking.code,
    };
  }
  return {
    status: 409,
    scopesGranted: [],
    authorizationEventsCreated: 0,
    bookingCreated: false,
    code: 'use_booking_path',
  };
}

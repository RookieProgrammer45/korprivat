// Stripe Connect Express helpers for school organizations and instructors.
// Booking payouts / transfers live in payouts.ts (phase 4).

import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/payments/stripe';

export class ConnectNotConfiguredError extends Error {
  constructor(message = 'Stripe is not configured') {
    super(message);
    this.name = 'ConnectNotConfiguredError';
  }
}

export class ConnectOrgNotFoundError extends Error {
  constructor() {
    super('Organization not found');
    this.name = 'ConnectOrgNotFoundError';
  }
}

export class ConnectInstructorNotFoundError extends Error {
  constructor() {
    super('Instructor not found');
    this.name = 'ConnectInstructorNotFoundError';
  }
}

export class ConnectAccountMissingError extends Error {
  constructor() {
    super('Connect account missing');
    this.name = 'ConnectAccountMissingError';
  }
}

export type ConnectStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
};

async function requireOrg(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new ConnectOrgNotFoundError();
  return org;
}

export async function createConnectAccount(orgId: string): Promise<{ accountId: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const org = await requireOrg(orgId);
  if (org.stripeAccountId) {
    return { accountId: org.stripeAccountId };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'SE',
    email: org.contactEmail ?? undefined,
    business_type: 'company',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { organizationId: orgId },
  });

  try {
    // Null-gated write so only one concurrent request wins the org row.
    const claimed = await prisma.organization.updateMany({
      where: { id: orgId, stripeAccountId: null },
      data: { stripeAccountId: account.id },
    });

    if (claimed.count === 0) {
      const winner = await requireOrg(orgId);
      if (winner.stripeAccountId) {
        console.warn('[connect] race: Express account orphaned after concurrent create', {
          orgId,
          orphanedAccountId: account.id,
          keptAccountId: winner.stripeAccountId,
        });
        return { accountId: winner.stripeAccountId };
      }
      throw new Error('connect_account_claim_failed');
    }

    return { accountId: account.id };
  } catch (err) {
    // Unique on stripeAccountId — another writer claimed this account id (rare).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const winner = await requireOrg(orgId);
      if (winner.stripeAccountId) {
        return { accountId: winner.stripeAccountId };
      }
    }
    throw err;
  }
}

export async function createOnboardingLink(
  orgId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<{ url: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const org = await requireOrg(orgId);
  if (!org.stripeAccountId) {
    throw new ConnectAccountMissingError();
  }

  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: org.stripeAccountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  if (!link.url) {
    throw new Error('stripe_account_link_missing_url');
  }

  return { url: link.url };
}

export async function getConnectStatus(orgId: string): Promise<ConnectStatus> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const org = await requireOrg(orgId);
  if (!org.stripeAccountId) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: [],
    };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(org.stripeAccountId);
  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    currentlyDue: account.requirements?.currently_due ?? [],
  };
}

export async function refreshConnectStatus(orgId: string): Promise<ConnectStatus> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const org = await requireOrg(orgId);
  if (!org.stripeAccountId) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: [],
    };
  }

  const status = await getConnectStatus(orgId);
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
    },
  });

  return status;
}

export async function createDashboardLink(orgId: string): Promise<{ url: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const org = await requireOrg(orgId);
  if (!org.stripeAccountId) {
    throw new ConnectAccountMissingError();
  }

  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(org.stripeAccountId);
  if (!link.url) {
    throw new Error('stripe_login_link_missing_url');
  }
  return { url: link.url };
}

/** Persist Connect flags from an account.updated webhook payload (orgs). */
export async function applyConnectAccountUpdated(account: {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
}): Promise<{ updated: boolean }> {
  const result = await prisma.organization.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    },
  });
  return { updated: result.count > 0 };
}

// ─── Instructor Connect Express ───────────────────────────────────────

async function requireInstructor(instructorId: string) {
  const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } });
  if (!instructor) throw new ConnectInstructorNotFoundError();
  return instructor;
}

export async function createInstructorConnectAccount(
  instructorId: string,
): Promise<{ accountId: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const instructor = await requireInstructor(instructorId);
  if (instructor.stripeAccountId) {
    return { accountId: instructor.stripeAccountId };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'SE',
    email: instructor.email ?? undefined,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { instructorId },
  });

  try {
    const claimed = await prisma.instructor.updateMany({
      where: { id: instructorId, stripeAccountId: null },
      data: { stripeAccountId: account.id },
    });

    if (claimed.count === 0) {
      const winner = await requireInstructor(instructorId);
      if (winner.stripeAccountId) {
        console.warn('[connect] race: Express account orphaned after concurrent instructor create', {
          instructorId,
          orphanedAccountId: account.id,
          keptAccountId: winner.stripeAccountId,
        });
        return { accountId: winner.stripeAccountId };
      }
      throw new Error('connect_instructor_account_claim_failed');
    }

    return { accountId: account.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const winner = await requireInstructor(instructorId);
      if (winner.stripeAccountId) {
        return { accountId: winner.stripeAccountId };
      }
    }
    throw err;
  }
}

export async function createInstructorOnboardingLink(
  instructorId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<{ url: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const instructor = await requireInstructor(instructorId);
  if (!instructor.stripeAccountId) {
    throw new ConnectAccountMissingError();
  }

  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: instructor.stripeAccountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  if (!link.url) {
    throw new Error('stripe_account_link_missing_url');
  }

  return { url: link.url };
}

export async function getInstructorConnectStatus(instructorId: string): Promise<ConnectStatus> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const instructor = await requireInstructor(instructorId);
  if (!instructor.stripeAccountId) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: [],
    };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(instructor.stripeAccountId);
  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    currentlyDue: account.requirements?.currently_due ?? [],
  };
}

export async function refreshInstructorConnectStatus(
  instructorId: string,
): Promise<ConnectStatus> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const instructor = await requireInstructor(instructorId);
  if (!instructor.stripeAccountId) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: [],
    };
  }

  const status = await getInstructorConnectStatus(instructorId);
  await prisma.instructor.update({
    where: { id: instructorId },
    data: {
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
    },
  });

  return status;
}

export async function createInstructorDashboardLink(
  instructorId: string,
): Promise<{ url: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ConnectNotConfiguredError();
  }

  const instructor = await requireInstructor(instructorId);
  if (!instructor.stripeAccountId) {
    throw new ConnectAccountMissingError();
  }

  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(instructor.stripeAccountId);
  if (!link.url) {
    throw new Error('stripe_login_link_missing_url');
  }
  return { url: link.url };
}

/** Persist Connect flags from an account.updated webhook payload (instructors). */
export async function applyInstructorAccountUpdated(account: {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
}): Promise<{ updated: boolean }> {
  const result = await prisma.instructor.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    },
  });
  return { updated: result.count > 0 };
}

// Stripe Connect Express helpers for school organizations (slice 7a).
// Does not handle booking payouts / transfers — that is 7c.

import 'server-only';
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

export class ConnectAccountMissingError extends Error {
  constructor() {
    super('Organization has no Stripe Connect account');
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

  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeAccountId: account.id },
  });

  return { accountId: account.id };
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

/** Persist Connect flags from an account.updated webhook payload. */
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

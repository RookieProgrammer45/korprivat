'use client';

import { PayoutsCard, type PayoutsState } from '@/components/custom/payouts/payouts-card';

export type SchoolPayoutsState = PayoutsState;

type Props = {
  organizationId: string;
  state: SchoolPayoutsState;
  isOwner: boolean;
};

export function SchoolPayoutsCard({ organizationId, state, isOwner }: Props) {
  return (
    <PayoutsCard
      connectBasePath={`/api/orgs/${encodeURIComponent(organizationId)}/connect`}
      i18nNamespace="schoolPayouts"
      canManage={isOwner}
      state={state}
    />
  );
}

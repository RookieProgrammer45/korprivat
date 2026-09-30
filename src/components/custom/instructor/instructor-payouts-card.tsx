'use client';

import { PayoutsCard, type PayoutsState } from '@/components/custom/payouts/payouts-card';

export type InstructorPayoutsState = PayoutsState;

type Props = {
  state: InstructorPayoutsState;
  canManage?: boolean;
};

export function InstructorPayoutsCard({ state, canManage = true }: Props) {
  return (
    <PayoutsCard
      connectBasePath="/api/instructors/me/connect"
      i18nNamespace="instructorPayouts"
      canManage={canManage}
      state={state}
    />
  );
}

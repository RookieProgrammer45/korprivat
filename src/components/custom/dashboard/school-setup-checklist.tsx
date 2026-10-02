import { SetupChecklist } from '@/components/custom/dashboard/setup-checklist';

export type SchoolSetupFlags = {
  detailsComplete: boolean;
  hasInstructorMember: boolean;
  connectReady: boolean;
};

type Props = {
  flags: SchoolSetupFlags;
  title: string;
  description: string;
  stepDetailsLabel: string;
  stepDetailsCta: string;
  stepInviteLabel: string;
  stepInviteCta: string;
  stepConnectLabel: string;
  stepConnectCta: string;
};

/**
 * School activation sequence — all steps visible. Hidden when complete.
 */
export function SchoolSetupChecklist({
  flags,
  title,
  description,
  stepDetailsLabel,
  stepDetailsCta,
  stepInviteLabel,
  stepInviteCta,
  stepConnectLabel,
  stepConnectCta,
}: Props) {
  if (flags.detailsComplete && flags.hasInstructorMember && flags.connectReady) {
    return null;
  }

  return (
    <SetupChecklist
      id="school-setup-checklist"
      title={title}
      description={description}
      steps={[
        {
          id: 'details',
          label: stepDetailsLabel,
          completed: flags.detailsComplete,
          ctaLabel: stepDetailsCta,
          ctaHref: '/dashboard/school/settings',
        },
        {
          id: 'invite',
          label: stepInviteLabel,
          completed: flags.hasInstructorMember,
          ctaLabel: stepInviteCta,
          ctaHref: '/dashboard/school?invite=open#instructors',
        },
        {
          id: 'connect',
          label: stepConnectLabel,
          completed: flags.connectReady,
          ctaLabel: stepConnectCta,
          ctaHref: '#school-payouts',
        },
      ]}
    />
  );
}

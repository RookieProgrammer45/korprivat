// @polsia:user-owned — public privacy-policy shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrivacyPolicyContent } from '@/components/custom/privacy-policy-content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacyPage.meta');
  return {
    title: { absolute: `${t('title')} · DriveLinkUp` },
    description: t('description'),
    alternates: { canonical: '/privacy' },
  };
}

export default function PrivacyPage() {
  return <PrivacyPolicyContent />;
}

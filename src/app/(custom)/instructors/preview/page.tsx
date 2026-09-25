// @polsia:user-owned — learner-side profile preview shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InstructorPreview } from '@/components/custom/instructor-preview';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorPreview.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/instructors/preview' },
  };
}

export default function InstructorPreviewPage() {
  return (
    <main className="container-page section">
      <InstructorPreview pageIntro />
    </main>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RiskCourseLanding } from '@/components/custom/risk-course-landing';
import { isRiskCoursesOn } from '@/lib/discovery/risk-course-policy';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipality: string }>;
}): Promise<Metadata> {
  const { municipality } = await params;
  const t = await getTranslations('riskCourses');
  return {
    title: t('title', { course: t('course.RISK_1'), municipality }),
    robots: { index: isRiskCoursesOn(), follow: isRiskCoursesOn() },
  };
}

export default async function RiskettanPage({
  params,
  searchParams,
}: {
  params: Promise<{ municipality: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { municipality } = await params;
  const { date } = await searchParams;
  return <RiskCourseLanding courseType="RISK_1" municipality={municipality} date={date} />;
}

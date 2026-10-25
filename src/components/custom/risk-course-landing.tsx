import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RiskCourseRequestForm } from '@/components/custom/risk-course-request-form';
import {
  isRiskCoursesOn,
  isRiskCourseType,
  type RiskCourseType,
} from '@/lib/discovery/risk-course-policy';
import { listDiscoverableRiskSessions } from '@/lib/discovery/risk-course-store';

export async function RiskCourseLanding({
  courseType,
  municipality,
  date,
}: {
  courseType: string;
  municipality: string;
  date?: string;
}) {
  if (!isRiskCoursesOn() || !isRiskCourseType(courseType)) notFound();
  const t = await getTranslations('riskCourses');
  const sessions = await listDiscoverableRiskSessions({
    courseType: courseType as RiskCourseType,
    municipality,
    date,
  });
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">
        {t('title', { course: t(`course.${courseType}`), municipality })}
      </h1>
      <p className="text-sm text-muted-foreground">{t('lead')}</p>
      <p className="text-sm text-muted-foreground">{t('honestSeats')}</p>
      {sessions.length === 0 ? (
        <p className="text-sm">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">{session.schoolName}</p>
              <p>
                {t('when', { when: session.startsAt })} · {session.location}
              </p>
              <p>
                {t('price', { price: session.priceSek })} ·{' '}
                {t('seats', { count: session.remainingSeats })}
              </p>
              <RiskCourseRequestForm sessionId={session.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

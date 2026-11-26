// Schools the learner has already booked. The action is the school's
// contact button. DriveLinkUp does not start a new booking from here.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { SchoolContactButton } from '@/components/custom/school-contact-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { ProfileMeReadout } from '@/lib/contracts/saved-payment-methods';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; items: ProfileMeReadout['lastInstructors'] }
  | { kind: 'error' }
  | { kind: 'empty' };

export function RebookPanel() {
  const t = useTranslations('dashboard.student.rebook');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/profile/me', { schema: ProfileMeReadout })
      .then((data) => {
        if (!active) return;
        if (data.lastInstructors.length === 0) {
          // It's possible the learner has zero past bookings AND a
          // signed-in session — in which case we render nothing rather
          // than a "no rebook yet" copy. The page below already has its
          // own empty-state.
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ready', items: data.lastInstructors });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind !== 'ready') return null;

  if (state.items.length === 0) return null;

  return (
    <section className="grid gap-3" aria-label={t('ariaLabel')}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h2>
      </div>
      <p className="text-small text-muted-foreground">{t('lead')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {state.items.map((row) => (
          <li key={row.id}>
            <Card className="border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
              <CardContent className="grid gap-3 p-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-base font-semibold text-foreground">
                    {row.name}
                  </span>
                  <span className="text-small text-muted-foreground">
                    {row.city ? `${row.city} · ${row.category}` : row.category}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {row.schoolContact ? (
                    <SchoolContactButton name={row.name} contact={row.schoolContact} size="sm" />
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/instructors/${encodeURIComponent(row.id)}`}>
                        {t('cta', { teacher: row.name.split(' ')[0] ?? row.name })}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

//
// Single primary CTA for incomplete host activation on the instructor
// dashboard (licence → listing → Connect → availability).

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type HostChecklistAction,
  pickHostChecklistAction,
} from '@/lib/business/host-checklist';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import { LicenseStatusResponse } from '@/lib/contracts/instructor-license';

type Props = {
  hasListing: boolean;
  connectReady: boolean;
};

const HREF: Record<Exclude<HostChecklistAction, 'licence' | 'connect'>, string> = {
  listing: '/instructors/new',
  availability: '/dashboard/instructor/availability',
};

export function InstructorHostChecklist({ hasListing, connectReady }: Props) {
  const t = useTranslations('dashboard.instructor.checklist');
  const [action, setAction] = useState<HostChecklistAction | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    void (async () => {
      let licenceVerified = false;
      let hasAvailability = false;

      try {
        const license = await apiFetch('/api/instructor-license', {
          schema: LicenseStatusResponse,
        });
        licenceVerified = license.status === 'VERIFIED';
      } catch {
        licenceVerified = false;
      }

      if (hasListing) {
        try {
          const slots = await apiFetch('/api/instructor-availability', {
            schema: AvailabilitySlotList,
          });
          const now = Date.now();
          hasAvailability = slots.items.some(
            (slot) => slot.bookedAt === null && new Date(slot.startsAt).getTime() > now,
          );
        } catch {
          hasAvailability = false;
        }
      }

      if (!active) return;
      setAction(
        pickHostChecklistAction({
          licenceVerified,
          hasListing,
          connectReady,
          hasAvailability,
        }),
      );
    })();

    return () => {
      active = false;
    };
  }, [hasListing, connectReady]);

  if (action === undefined || action === null) {
    return null;
  }

  const href =
    action === 'licence'
      ? '/dashboard/instructor'
      : action === 'connect'
        ? '#instructor-connect'
        : HREF[action];

  return (
    <aside
      id="host-checklist"
      className="flex flex-col gap-3 rounded-xl border border-brand-500/35 bg-brand-50/80 px-4 py-3 text-small text-foreground sm:flex-row sm:items-center sm:justify-between dark:bg-brand-950/40"
    >
      <div className="grid gap-1">
        <p className="text-pretty font-medium">{t(`${action}.title`)}</p>
        <p className="text-pretty text-muted-foreground">{t(`${action}.body`)}</p>
      </div>
      <Button asChild className="sm:shrink-0">
        <Link href={href}>{t(`${action}.cta`)}</Link>
      </Button>
    </aside>
  );
}

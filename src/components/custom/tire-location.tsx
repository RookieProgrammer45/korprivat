'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useUserLocation } from '@/hooks/use-user-location';
import { nearestTireCity, tireCityCountry } from '@/lib/discovery/tire-place';

export function TireLocation({ place }: { place: string | null }) {
  const t = useTranslations('tirePage');
  const location = useUserLocation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (location.status !== 'granted' || !location.coords) return;
    const params = new URLSearchParams(searchParams.toString());
    const city = nearestTireCity(location.coords.latitude, location.coords.longitude);
    if (!city) {
      if (params.get('near') === 'none' && !params.get('place')) return;
      params.delete('place');
      params.set('near', 'none');
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }
    const country = tireCityCountry(city);
    if (params.get('place') === city && params.get('near') == null) return;
    params.delete('near');
    params.set('place', city);
    if (country) params.set('country', country);
    router.replace(`${pathname}?${params.toString()}`);
  }, [location.coords, location.status, pathname, router, searchParams]);

  const nearNone = searchParams.get('near') === 'none';
  const statusKey =
    location.status === 'idle'
      ? nearNone
        ? 'locationNone'
        : 'locationPrompt'
      : location.status === 'requesting'
        ? 'locationRequesting'
        : location.status === 'granted'
          ? place
            ? 'locationGranted'
            : 'locationNone'
          : location.status === 'denied'
            ? 'locationDenied'
            : location.status === 'unsupported'
              ? 'locationUnsupported'
              : 'locationFailed';

  function clearLocation() {
    location.reset();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('place');
    params.delete('near');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="grid min-w-0 gap-2 sm:col-span-1">
      <p className="text-small text-muted-foreground">{t(statusKey)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={location.request}
          disabled={location.status === 'requesting'}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground"
        >
          {t('useMyLocation')}
        </button>
        {place || nearNone ? (
          <button
            type="button"
            onClick={clearLocation}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-muted-foreground"
          >
            {t('clearLocation')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryChipLabel } from '@/components/custom/instructor-preview';
import { MAX_COMPARISON_ITEMS, ProviderComparison } from '@/components/custom/provider-comparison';
import { SchoolContactActions } from '@/components/custom/school-contact-button';
import {
  SCHOOL_LISTING_GRID_CLASS,
  SchoolListingCard,
} from '@/components/custom/school-listing-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { type LocationStatus, useUserLocation } from '@/hooks/use-user-location';
import { apiFetch } from '@/lib/api-client';
import { nearestKnownCity } from '@/lib/business/geo';
import {
  HEAVY_FILTERS,
  type HeavyFilter,
  LICENCE_CATEGORY_CODES,
  type LicenceCategoryCode,
} from '@/lib/business/licence-categories';
import {
  type InstructorFilteredItem,
  InstructorList,
  type InstructorQuery,
  parseInstructorQuery,
} from '@/lib/contracts/instructors';
import { schoolPath } from '@/lib/seo/school-slugs';

type SortMode = 'default' | 'distance' | 'lessonPrice' | 'packagePrice';

// Local mirror of the typed filter spec, derived from URL state. The island
// also keeps a parallel `initialCities` array so the city dropdown is populated
// from the first fetch even if a later, empty-filter fetch produces an
// empty `cities` set. Geo fields (`lat`, `lng`, `nearKm`, `sort`) flow through
// the same URL → filters → query-string round-trip pattern the existing
// filters already use so the URL is canonical when sharing a search.
type Filters = {
  categories: LicenceCategoryCode[];
  city: string | '';
  minRate: number | '';
  maxRate: number | '';
  minRating: number | '';
  availability: 'weekday' | 'weekend' | '';
  english: boolean;
  lat: number | null;
  lng: number | null;
  nearKm: number | '';
  sort: SortMode;
  providerRole: 'INSTRUCTOR' | 'HANDLEDARE' | '';
  affiliation: 'school' | 'independent' | 'all' | '';
  heavy: HeavyFilter | '';
};

const EMPTY_FILTERS: Filters = {
  categories: [],
  city: '',
  minRate: '',
  maxRate: '',
  minRating: '',
  availability: '',
  english: false,
  lat: null,
  lng: null,
  nearKm: '',
  sort: 'default',
  providerRole: '',
  affiliation: '',
  heavy: '',
};

// Radix `<Select.Item value="">` throws on hydration — use a non-empty
// sentinel for the "All cities" option and translate ↔ '' at the binding
// sites so filters/URL/API keep using empty string as "no city filter".
const CITY_ALL = '__all__';
const RATING_ALL = '__all_ratings__';
const AVAILABILITY_ALL = '__all_availability__';
const AFFILIATION_ALL = '__all_affiliation__';

type Status = 'loading' | 'ready' | 'empty' | 'error' | 'invalid';

export function InstructorDirectory({
  initialFilters,
  heavyScope = false,
}: {
  initialFilters?: Partial<Filters>;
  // The heavy-vehicle page stays on truck, bus and YKB schools. Clearing
  // filters returns to that list instead of the whole catalogue.
  heavyScope?: boolean;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tr = useTranslations('instructorDirectory');

  const [filters, setFilters] = useState<Filters>(() => {
    const parsedFilters = filtersFromSearchParams(new URLSearchParams(searchParams.toString()));
    return parsedFilters ?? { ...EMPTY_FILTERS, ...initialFilters };
  });
  const [initialCities, setInitialCities] = useState<string[]>([]);
  // Canonicalise the prop-driven initial filter set into the URL on first
  // mount without overwriting explicit URL filters. The ref freezes
  // `initialFilters` at the first mount so later user edits are not clobbered.
  const initialFiltersRef = useRef(initialFilters);
  const initialFiltersAppliedRef = useRef(false);
  useEffect(() => {
    if (initialFiltersAppliedRef.current) return;
    initialFiltersAppliedRef.current = true;
    const seed = initialFiltersRef.current;
    if (!seed) return;
    const params = new URLSearchParams(searchParams.toString());
    const seededParams = new URLSearchParams(buildQueryString({ ...EMPTY_FILTERS, ...seed }));
    for (const [key, value] of seededParams) {
      if (!params.has(key)) params.append(key, value);
    }
    const qs = params.toString();
    if (qs === searchParams.toString()) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
  const [status, setStatus] = useState<Status>('loading');
  const [items, setItems] = useState<InstructorFilteredItem[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  // Bump from the Retry handler so the fetch effect fires again even when
  // the canonical query string is unchanged.
  const [retryNonce, setRetryNonce] = useState(0);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonLimitReached, setComparisonLimitReached] = useState(false);

  // Browser-side geolocation state. The hook itself never prompts — that
  // happens only when `onLocationRequest` is wired to its `request()` from
  // the user clicking "Use my location".
  const location = useUserLocation();
  const requestLocation = location.request;
  const resetLocation = location.reset;

  // Stable, sorted query string snapshot used to key the fetch effect and to
  // build the URL when filters change.
  const queryString = useMemo(() => buildQueryString(filters), [filters]);
  const hasInvalidRateRange =
    typeof filters.minRate === 'number' &&
    typeof filters.maxRate === 'number' &&
    filters.minRate > filters.maxRate;

  // Whenever the URL changes (back/forward, or our own router.replace below),
  // re-derive the local filter state so the controls stay in sync with the
  // canonical URL. We treat invalid URL values as "filter unset" — the only
  // valid source of truth is the URL itself.
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    const parsed = filtersFromSearchParams(sp);
    if (parsed) {
      setFilters(parsed);
      return;
    }
    const seed = initialFiltersRef.current;
    if (seed && Object.keys(seed).length > 0) {
      setFilters({ ...EMPTY_FILTERS, ...seed });
      return;
    }
    setFilters(EMPTY_FILTERS);
  }, [searchParams]);

  // Do not reset the hook whenever `location` changes identity. That raced
  // the granted write and cleared a successful fix before lat/lng landed.

  // Run the data fetch whenever the canonical query string changes. We track
  // liveness with `active` so an in-flight response from a stale query can't
  // paint over a newer one (mirrors `InstructorDetail`).
  useEffect(() => {
    let active = true;
    setStatus('loading');
    if (hasInvalidRateRange) {
      setStatus('invalid');
      return () => {
        active = false;
      };
    }
    // retryNonce is a ticks-only trigger bumped by the Retry button — it
    // re-runs this effect without changing the canonical query string.
    void retryNonce;
    apiFetch(`/api/instructors${queryString ? `?${queryString}` : ''}`, {
      schema: InstructorList,
    })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setLoadedQuery(queryString);
        // Keep the first filtered city list for empty-state recovery, then
        // replace it with the complete list after an unfiltered fetch.
        setInitialCities((prev) => (queryString === '' || prev.length === 0 ? data.cities : prev));
        setStatus(data.items.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [hasInvalidRateRange, queryString, retryNonce]);

  const hasAnyFilter = useMemo(() => hasActiveFilter(filters), [filters]);

  const replaceUrl = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams(buildQueryString(next));
      // buildQueryString already covers every new field — keep using the
      // same serializer so back/forward and direct URL edits round-trip.
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const updateFilters = useCallback(
    (patch: Partial<Filters>) => {
      setFilters((curr) => {
        const next: Filters = { ...curr, ...patch };
        if (!isInvalidRateRange(next)) replaceUrl(next);
        return next;
      });
    },
    [replaceUrl],
  );

  const toggleCategory = useCallback(
    (code: LicenceCategoryCode) => {
      setFilters((curr) => {
        const has = curr.categories.includes(code);
        const nextCats = has
          ? curr.categories.filter((c) => c !== code)
          : [...curr.categories, code];
        const next: Filters = { ...curr, categories: nextCats };
        replaceUrl(next);
        return next;
      });
    },
    [replaceUrl],
  );

  const clearFilters = useCallback(() => {
    resetLocation();
    const next: Filters = heavyScope ? { ...EMPTY_FILTERS, heavy: 'all' } : EMPTY_FILTERS;
    setFilters(next);
    const qs = buildQueryString(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [heavyScope, pathname, resetLocation, router]);

  const toggleComparison = useCallback((id: string) => {
    setComparisonLimitReached(false);
    setComparisonIds((current) => {
      if (current.includes(id)) return current.filter((itemId) => itemId !== id);
      if (current.length >= MAX_COMPARISON_ITEMS) {
        setComparisonLimitReached(true);
        return current;
      }
      return [...current, id];
    });
  }, []);

  const comparisonItems = useMemo(
    () =>
      comparisonIds
        .map((id) => items.find((item) => item.id === id))
        .filter(Boolean) as InstructorFilteredItem[],
    [comparisonIds, items],
  );
  const showingCurrentResults = status === 'ready' && loadedQuery === queryString;

  const onLocationRequest = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  // When the hook resolves to `granted`, write the coords into filters so the
  // `?lat=…&lng=…` URL becomes canonical (shareable, bookmarkable, refresh-
  // safe). The hook holds the in-memory source for the current session; the
  // URL is the source for everything else.
  useEffect(() => {
    if (location.status !== 'granted' || !location.coords) return;
    const grantedLat = location.coords.latitude;
    const grantedLng = location.coords.longitude;
    setFilters((curr) => {
      if (curr.lat === grantedLat && curr.lng === grantedLng) return curr;
      const city = curr.city || nearestKnownCity(grantedLat, grantedLng);
      const next: Filters = {
        ...curr,
        lat: grantedLat,
        lng: grantedLng,
        sort: 'distance',
        ...(city ? { city } : {}),
        ...(curr.nearKm === '' ? { nearKm: 40 } : {}),
      };
      replaceUrl(next);
      return next;
    });
  }, [location.status, location.coords, replaceUrl]);

  return (
    <section className="mt-10 flex min-w-0 w-full flex-col gap-7">
      <Suspense>
        <FilterBar
          filters={filters}
          cities={initialCities}
          locationStatus={location.status}
          onToggleCategory={toggleCategory}
          onCityChange={(value) => updateFilters({ city: value })}
          onMinRateChange={(value) => updateFilters({ minRate: value })}
          onMaxRateChange={(value) => updateFilters({ maxRate: value })}
          onMinRatingChange={(value) => updateFilters({ minRating: value })}
          onAvailabilityChange={(value) => updateFilters({ availability: value })}
          onEnglishChange={(value) => updateFilters({ english: value })}
          onNearKmChange={(value) => updateFilters({ nearKm: value })}
          onSortChange={(value) => updateFilters({ sort: value })}
          onAffiliationChange={(value) => updateFilters({ affiliation: value })}
          onHeavyChange={(value) => updateFilters({ heavy: value })}
          heavyScope={heavyScope}
          onLocationRequest={onLocationRequest}
          onClearGeolocation={() => {
            resetLocation();
            updateFilters({
              lat: null,
              lng: null,
              sort: filters.sort === 'distance' ? 'default' : filters.sort,
              nearKm: '',
            });
          }}
        />

        {hasAnyFilter && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {tr('clearFilters')}
            </Button>
          </div>
        )}

        {status === 'loading' && <CardGridSkeleton />}
        {status === 'empty' && <EmptyState onClear={clearFilters} />}
        {status === 'error' && <ErrorState onRetry={() => setRetryNonce((n) => n + 1)} />}
        {comparisonLimitReached ? (
          <output className="text-small text-muted-foreground">
            {tr('comparison.limitReached')}
          </output>
        ) : null}
        {showingCurrentResults && comparisonItems.length > 0 ? (
          <ProviderComparison
            providers={comparisonItems}
            onRemove={toggleComparison}
            onClear={() => setComparisonIds([])}
            heavyScope={heavyScope}
          />
        ) : null}
        <div aria-live="polite" className="min-h-5 text-small text-muted-foreground">
          {status === 'loading'
            ? tr('loadingResults')
            : (status === 'ready' || status === 'empty') && loadedQuery === queryString
              ? tr('resultCount', { count: items.length })
              : null}
        </div>
        {showingCurrentResults && (
          <CardGrid
            items={items}
            comparisonIds={comparisonIds}
            onToggleComparison={toggleComparison}
            heavyScope={heavyScope}
          />
        )}
      </Suspense>
    </section>
  );
}

// ───────────────────── filter bar ─────────────────────

function FilterBar({
  filters,
  cities,
  locationStatus,
  onToggleCategory,
  onCityChange,
  onMinRateChange,
  onMaxRateChange,
  onMinRatingChange,
  onAvailabilityChange,
  onEnglishChange,
  onNearKmChange,
  onSortChange,
  onAffiliationChange,
  onHeavyChange,
  heavyScope = false,
  onLocationRequest,
  onClearGeolocation,
}: {
  filters: Filters;
  cities: string[];
  locationStatus: LocationStatus;
  onToggleCategory: (code: LicenceCategoryCode) => void;
  onCityChange: (value: string) => void;
  onMinRateChange: (value: number | '') => void;
  onMaxRateChange: (value: number | '') => void;
  onMinRatingChange: (value: number | '') => void;
  onAvailabilityChange: (value: 'weekday' | 'weekend' | '') => void;
  onEnglishChange: (value: boolean) => void;
  onNearKmChange: (value: number | '') => void;
  onSortChange: (value: SortMode) => void;
  onAffiliationChange: (value: 'school' | 'independent' | 'all' | '') => void;
  onHeavyChange: (value: HeavyFilter | '') => void;
  heavyScope?: boolean;
  onLocationRequest: () => void;
  onClearGeolocation: () => void;
}) {
  const tr = useTranslations('instructorDirectory');
  const hasLocation = filters.lat != null || filters.lng != null;
  const statusCopy = locationStatusCopy(locationStatus, tr);
  const hasInvalidRateRange =
    typeof filters.minRate === 'number' &&
    typeof filters.maxRate === 'number' &&
    filters.minRate > filters.maxRate;

  return (
    <Card className="surface-panel border-border bg-card">
      <CardContent className="flex min-w-0 flex-col gap-6 p-6">
        {heavyScope ? null : (
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow">{tr('categoryLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {LICENCE_CATEGORY_CODES.map((code) => {
                const active = filters.categories.includes(code);
                return (
                  <Button
                    key={code}
                    type="button"
                    variant={active ? 'secondary' : 'outline'}
                    size="sm"
                    aria-pressed={active}
                    className={
                      active
                        ? 'border border-brand-500/40 bg-brand-100 text-brand-700 shadow-sm hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-300'
                        : undefined
                    }
                    onClick={() => onToggleCategory(code)}
                  >
                    {categoryChipLabel(tr(`category.${code}`), code)}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="city-select">{tr('cityLabel')}</Label>
            <Select
              value={cities.includes(filters.city) ? filters.city : CITY_ALL}
              onValueChange={(v) => onCityChange(v === CITY_ALL ? '' : v)}
            >
              <SelectTrigger id="city-select" className="bg-background">
                <SelectValue placeholder={tr('cityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CITY_ALL}>{tr('cityAllOption')}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {heavyScope ? null : (
            <>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="min-rate-input">{tr('minRateLabel')}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-caption text-muted-foreground">
                    {tr('rateSuffixShort')}
                  </span>
                  <Input
                    id="min-rate-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={filters.minRate}
                    onChange={(event) => {
                      const raw = event.target.value;
                      onMinRateChange(raw === '' ? '' : Number(raw));
                    }}
                    className="bg-background pl-12"
                    placeholder={tr('minRatePlaceholder')}
                    aria-invalid={hasInvalidRateRange}
                    aria-describedby={hasInvalidRateRange ? 'rate-range-error' : undefined}
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="max-rate-input">{tr('maxRateLabel')}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-caption text-muted-foreground">
                    {tr('rateSuffixShort')}
                  </span>
                  <Input
                    id="max-rate-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={filters.maxRate}
                    onChange={(event) => {
                      const raw = event.target.value;
                      onMaxRateChange(raw === '' ? '' : Number(raw));
                    }}
                    className="bg-background pl-12"
                    placeholder={tr('maxRatePlaceholder')}
                    aria-invalid={hasInvalidRateRange}
                    aria-describedby={hasInvalidRateRange ? 'rate-range-error' : undefined}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="rating-select">{tr('ratingLabel')}</Label>
            <Select
              value={filters.minRating === '' ? RATING_ALL : String(filters.minRating)}
              onValueChange={(value) =>
                onMinRatingChange(value === RATING_ALL ? '' : Number(value))
              }
            >
              <SelectTrigger id="rating-select" className="bg-background">
                <SelectValue placeholder={tr('ratingPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RATING_ALL}>{tr('ratingAllOption')}</SelectItem>
                <SelectItem value="3">{tr('rating3Plus')}</SelectItem>
                <SelectItem value="4">{tr('rating4Plus')}</SelectItem>
                <SelectItem value="4.5">{tr('rating4_5Plus')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="availability-select">{tr('availabilityLabel')}</Label>
            <Select
              value={filters.availability === '' ? AVAILABILITY_ALL : filters.availability}
              onValueChange={(value) =>
                onAvailabilityChange(
                  value === AVAILABILITY_ALL || (value !== 'weekday' && value !== 'weekend')
                    ? ''
                    : value,
                )
              }
            >
              <SelectTrigger id="availability-select" className="bg-background">
                <SelectValue placeholder={tr('availabilityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AVAILABILITY_ALL}>{tr('availabilityAllOption')}</SelectItem>
                <SelectItem value="weekday">{tr('weekday')}</SelectItem>
                <SelectItem value="weekend">{tr('weekend')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="affiliation-select">{tr('affiliationLabel')}</Label>
            <Select
              value={
                filters.affiliation === '' || filters.affiliation === 'all'
                  ? AFFILIATION_ALL
                  : filters.affiliation
              }
              onValueChange={(value) => {
                if (value === AFFILIATION_ALL) onAffiliationChange('');
                else if (value === 'school' || value === 'independent') onAffiliationChange(value);
                else onAffiliationChange('');
              }}
            >
              <SelectTrigger id="affiliation-select" className="bg-background">
                <SelectValue placeholder={tr('affiliationAll')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AFFILIATION_ALL}>{tr('affiliationAll')}</SelectItem>
                <SelectItem value="school">{tr('affiliationSchool')}</SelectItem>
                <SelectItem value="independent">{tr('affiliationIndependent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {heavyScope ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="heavy-select">{tr('heavyLabel')}</Label>
              <Select
                value={filters.heavy === '' ? 'all' : filters.heavy}
                onValueChange={(value) => {
                  onHeavyChange(HEAVY_FILTERS.find((filter) => filter === value) ?? 'all');
                }}
              >
                <SelectTrigger id="heavy-select" className="bg-background">
                  <SelectValue placeholder={tr('heavyAllVehicles')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('heavyAllVehicles')}</SelectItem>
                  <SelectItem value="truck">{tr('heavyTruck')}</SelectItem>
                  <SelectItem value="bus">{tr('heavyBus')}</SelectItem>
                  <SelectItem value="ykb">{tr('heavyYkb')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-center gap-3 self-end sm:pb-0.5">
            <Switch
              id="english-switch"
              checked={filters.english}
              onCheckedChange={onEnglishChange}
            />
            <Label htmlFor="english-switch" className="cursor-pointer">
              {tr('englishOnly')}
            </Label>
          </div>
        </div>
        {hasInvalidRateRange ? (
          <p id="rate-range-error" role="alert" className="text-small text-destructive">
            {tr('rateRangeError')}
          </p>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4">
          <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-eyebrow">{tr('geoTitle')}</p>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLocationRequest}
                disabled={locationStatus === 'requesting'}
              >
                {tr('useMyLocation')}
              </Button>
              {hasLocation && (
                <Button type="button" variant="ghost" size="sm" onClick={onClearGeolocation}>
                  {tr('clearGeolocation')}
                </Button>
              )}
            </div>
          </div>
          <p className="text-small text-muted-foreground">{statusCopy}</p>

          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="near-km-input">{tr('nearKmLabel')}</Label>
              <Input
                id="near-km-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={20_000}
                value={filters.nearKm}
                onChange={(event) => {
                  const raw = event.target.value;
                  onNearKmChange(raw === '' ? '' : Number(raw));
                }}
                className="bg-background"
                placeholder={tr('nearKmPlaceholder')}
                disabled={!hasLocation}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="sort-select">{tr('sortLabel')}</Label>
              <Select
                value={filters.sort}
                onValueChange={(value) => onSortChange(toSortMode(value))}
              >
                <SelectTrigger id="sort-select" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{tr('sortNewest')}</SelectItem>
                  {heavyScope ? null : (
                    <>
                      <SelectItem value="lessonPrice">{tr('sortLessonPrice')}</SelectItem>
                      <SelectItem value="packagePrice">{tr('sortPackagePrice')}</SelectItem>
                    </>
                  )}
                  <SelectItem value="distance" disabled={!hasLocation}>
                    {tr('sortNearest')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function locationStatusCopy(
  status: LocationStatus,
  tr: ReturnType<typeof useTranslations<'instructorDirectory'>>,
): string {
  switch (status) {
    case 'idle':
      return tr('locationStatus.prompt');
    case 'requesting':
      return tr('locationStatus.requesting');
    case 'granted':
      return tr('locationStatus.granted');
    case 'denied':
      return tr('locationStatus.denied');
    case 'failed':
      return tr('locationStatus.failed');
    case 'unsupported':
      return tr('locationStatus.unsupported');
  }
}

// ───────────────────── card grid + states ─────────────────────

function CardGrid({
  items,
  comparisonIds,
  onToggleComparison,
  heavyScope = false,
}: {
  items: InstructorFilteredItem[];
  comparisonIds: string[];
  onToggleComparison: (id: string) => void;
  heavyScope?: boolean;
}) {
  const tr = useTranslations('instructorDirectory');
  return (
    <ul className={SCHOOL_LISTING_GRID_CLASS}>
      {items.map((row) => (
        // `data-next-slot-at` carries a null-safe sort key the eventual matcher
        // can scrape without re-parsing the row. Items with no upcoming slot
        // emit an empty string so a missing key means "free to interpret".
        <li
          key={row.id}
          data-next-slot-at={row.nextSlotAt ?? ''}
          className="grid h-full min-w-0 grid-rows-[1fr_auto] gap-2"
        >
          <SchoolListingCard row={row} heavyScope={heavyScope} />
          <div className="grid min-w-0 gap-2">
            <SchoolContactActions
              name={row.name}
              contact={row.contact}
              priceRequest={row.priceRequest}
              listing={schoolPath(row)}
              size="sm"
              className="w-full"
            />
            <Button
              type="button"
              variant={comparisonIds.includes(row.id) ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={comparisonIds.includes(row.id)}
              onClick={() => onToggleComparison(row.id)}
              className="w-full min-h-11"
            >
              {comparisonIds.includes(row.id)
                ? tr('comparison.removeFromComparison')
                : tr('comparison.addToComparison')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardGridSkeleton() {
  return (
    <ul className={SCHOOL_LISTING_GRID_CLASS}>
      {[
        'directory-skeleton-a',
        'directory-skeleton-b',
        'directory-skeleton-c',
        'directory-skeleton-d',
      ].map((skeletonId) => (
        <li key={skeletonId} aria-hidden>
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white sm:rounded-[1.25rem] dark:bg-card">
            <Skeleton className="aspect-[5/3] w-full rounded-none sm:aspect-[4/3]" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-7 w-1/3" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  const tr = useTranslations('instructorDirectory');
  return (
    <Card className="surface-panel directory-empty-state border-border bg-card">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="font-display text-h3 tracking-tight text-foreground">{tr('emptyTitle')}</p>
        <p className="max-w-sm text-small text-muted-foreground">{tr('emptyBody')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClear} className="mt-1">
          {tr('clearFilters')}
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const tr = useTranslations('instructorDirectory');
  return (
    <Card className="surface-panel directory-error-state border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col gap-3 p-6">
        <p className="text-small font-medium text-destructive">{tr('errorTitle')}</p>
        <p className="text-small text-muted-foreground">{tr('errorBody')}</p>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {tr('retry')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────── helpers ─────────────────────

function buildQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  for (const code of [...filters.categories].sort()) params.append('categories', code);
  if (filters.city) params.set('city', filters.city);
  if (typeof filters.minRate === 'number' && Number.isFinite(filters.minRate)) {
    params.set('minRate', String(filters.minRate));
  }
  if (typeof filters.maxRate === 'number' && Number.isFinite(filters.maxRate)) {
    params.set('maxRate', String(filters.maxRate));
  }
  if (typeof filters.minRating === 'number' && Number.isFinite(filters.minRating)) {
    params.set('minRating', String(filters.minRating));
  }
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.english) params.set('english', 'true');
  if (typeof filters.lat === 'number' && Number.isFinite(filters.lat)) {
    params.set('lat', String(filters.lat));
  }
  if (typeof filters.lng === 'number' && Number.isFinite(filters.lng)) {
    params.set('lng', String(filters.lng));
  }
  if (typeof filters.nearKm === 'number' && Number.isFinite(filters.nearKm)) {
    params.set('nearKm', String(filters.nearKm));
  }
  if (filters.sort !== 'default') params.set('sort', filters.sort);
  if (filters.providerRole) params.set('providerRole', filters.providerRole);
  if (filters.affiliation === 'school' || filters.affiliation === 'independent') {
    params.set('affiliation', filters.affiliation);
  }
  if (filters.heavy) params.set('heavy', filters.heavy);
  return params.toString();
}

function toSortMode(value: string | undefined): SortMode {
  return value === 'distance' || value === 'lessonPrice' || value === 'packagePrice'
    ? value
    : 'default';
}

function normaliseFromUrl(q: InstructorQuery): Filters {
  return {
    categories: q.categories ?? [],
    city: q.city ?? '',
    minRate: typeof q.minRate === 'number' ? q.minRate : '',
    maxRate: typeof q.maxRate === 'number' ? q.maxRate : '',
    minRating: typeof q.minRating === 'number' ? q.minRating : '',
    availability: q.availability ?? '',
    english: q.english === true,
    lat: typeof q.lat === 'number' ? q.lat : null,
    lng: typeof q.lng === 'number' ? q.lng : null,
    nearKm: typeof q.nearKm === 'number' ? q.nearKm : '',
    sort: toSortMode(q.sort),
    providerRole: q.providerRole ?? '',
    affiliation: q.affiliation === 'school' || q.affiliation === 'independent' ? q.affiliation : '',
    heavy: q.heavy ?? '',
  };
}

function filtersFromSearchParams(searchParams: URLSearchParams): Filters | null {
  const parsed = parseInstructorQuery(searchParams);
  if (parsed.ok) return normaliseFromUrl(parsed.value);

  // Keep an invalid range visible to the island so it can show the inline
  // error. The shared parser must still reject it at the API boundary, but a
  // direct deep link should not silently turn into an unfiltered search.
  const isOnlyRateRangeError =
    parsed.error.issues.length === 1 &&
    parsed.error.issues[0]?.code === 'custom' &&
    parsed.error.issues[0]?.path.join('.') === 'minRate';
  if (!isOnlyRateRangeError) return null;

  const withoutMinRate = new URLSearchParams(searchParams);
  withoutMinRate.delete('minRate');
  const withoutMaxRate = new URLSearchParams(searchParams);
  withoutMaxRate.delete('maxRate');
  const minParsed = parseInstructorQuery(withoutMaxRate);
  const maxParsed = parseInstructorQuery(withoutMinRate);
  if (!minParsed.ok || !maxParsed.ok) return null;

  return {
    ...normaliseFromUrl(minParsed.value),
    maxRate: maxParsed.value.maxRate ?? '',
  };
}

function hasActiveFilter(f: Filters): boolean {
  return (
    f.categories.length > 0 ||
    (typeof f.city === 'string' && f.city !== '') ||
    f.minRate !== '' ||
    f.maxRate !== '' ||
    f.minRating !== '' ||
    f.availability !== '' ||
    f.english ||
    f.lat != null ||
    f.lng != null ||
    f.nearKm !== '' ||
    f.sort !== 'default' ||
    f.providerRole !== '' ||
    f.affiliation === 'school' ||
    f.affiliation === 'independent' ||
    f.heavy !== ''
  );
}

function isInvalidRateRange(filters: Filters): boolean {
  return (
    typeof filters.minRate === 'number' &&
    typeof filters.maxRate === 'number' &&
    filters.minRate > filters.maxRate
  );
}

// This module is deliberately server/client safe: it contains no database or
// request imports, so the availability island and API handlers share it.

export const SWEDISH_TIMEZONE = 'Europe/Stockholm';
export const PROVIDER_FALLBACK_TIMEZONE = 'UTC';

const SWEDISH_CITIES = new Set([
  'boras',
  'eskilstuna',
  'gavle',
  'gothenburg',
  'goteborg',
  'halmstad',
  'helsingborg',
  'jonkoping',
  'kalmar',
  'karlstad',
  'kristianstad',
  'linkoping',
  'lund',
  'malmo',
  'norrkoping',
  'orebro',
  'sodertalje',
  'stockholm',
  'sundsvall',
  'umea',
  'uppsala',
  'vasteras',
  'vaxjo',
]);

function cityKey(city: string): string {
  return city
    .trim()
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

export function providerTimezoneForCity(city: string): string {
  return SWEDISH_CITIES.has(cityKey(city)) ? SWEDISH_TIMEZONE : PROVIDER_FALLBACK_TIMEZONE;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidLocalTime(value: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function partsInTimezone(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const result: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  if (result.hour === 24) result.hour = 0;
  return result;
}

/** Convert a `datetime-local` value into an instant in the provider timezone. */
export function localDateTimeToUtc(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!isValidCalendarDate(`${yearText}-${monthText}-${dayText}`)) return null;
  if (!isValidLocalTime(`${hourText}:${minuteText}`)) return null;

  const naiveMs = Date.UTC(year, month - 1, day, hour, minute);
  const projected = partsInTimezone(new Date(naiveMs), timeZone);
  const projectedMs = Date.UTC(
    projected.year ?? year,
    (projected.month ?? month) - 1,
    projected.day ?? day,
    projected.hour ?? hour,
    projected.minute ?? minute,
    projected.second ?? 0,
  );
  return new Date(naiveMs - (projectedMs - naiveMs));
}

export function localDateTimeToUtcIso(value: string, timeZone: string): string | null {
  const date = localDateTimeToUtc(value, timeZone);
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function formatProviderDate(
  iso: string | Date,
  locale: 'sv' | 'en' = 'sv',
  timeZone = SWEDISH_TIMEZONE,
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return typeof iso === 'string' ? iso : '';
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

export function utcToLocalDateTimeInput(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = partsInTimezone(date, timeZone);
  return `${String(parts.year ?? 0).padStart(4, '0')}-${String(parts.month ?? 0).padStart(2, '0')}-${String(parts.day ?? 0).padStart(2, '0')}T${String(parts.hour ?? 0).padStart(2, '0')}:${String(parts.minute ?? 0).padStart(2, '0')}`;
}

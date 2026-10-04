/**
 * Featured Sweden city hubs (home/nav). Paths come from the Nordic registry.
 */
import { locationPath } from '@/lib/seo/nordic-locations';

export const CITY_HUBS = [
  { key: 'stockholm', slug: 'stockholm', cityName: 'Stockholm' },
  { key: 'goteborg', slug: 'goteborg', cityName: 'Göteborg' },
  { key: 'malmo', slug: 'malmo', cityName: 'Malmö' },
  { key: 'uppsala', slug: 'uppsala', cityName: 'Uppsala' },
  { key: 'vasteras', slug: 'vasteras', cityName: 'Västerås' },
] as const;

export type CityHubKey = (typeof CITY_HUBS)[number]['key'];

export function cityHubPath(key: CityHubKey): string {
  return locationPath({ country: 'se', slug: key });
}

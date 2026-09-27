
import {
  type WesternNorthernSwedenCopy,
  WesternNorthernSwedenHub,
  type WesternNorthernSwedenHubResponse,
  WesternNorthernSwedenPageCopy,
} from '@/lib/contracts/western-northern-sweden';

const cityFilterHref = (city: string) => `/instructors?city=${encodeURIComponent(city)}`;

export const westernNorthernSwedenRegions = [
  {
    slug: 'vastra-gotaland',
    cityLinks: [
      { key: 'goteborg', href: '/instructors/goteborg' },
      { key: 'boras', href: cityFilterHref('Borås') },
      { key: 'trollhattan', href: cityFilterHref('Trollhättan') },
      { key: 'skovde', href: cityFilterHref('Skövde') },
    ],
  },
  {
    slug: 'varmland',
    cityLinks: [
      { key: 'karlstad', href: cityFilterHref('Karlstad') },
      { key: 'arvika', href: cityFilterHref('Arvika') },
      { key: 'kristinehamn', href: cityFilterHref('Kristinehamn') },
    ],
  },
  {
    slug: 'gavleborg-vasternorrland',
    cityLinks: [
      { key: 'gavle', href: cityFilterHref('Gävle') },
      { key: 'sundsvall', href: cityFilterHref('Sundsvall') },
      { key: 'hudiksvall', href: cityFilterHref('Hudiksvall') },
      { key: 'ornskoldsvik', href: cityFilterHref('Örnsköldsvik') },
    ],
  },
  {
    slug: 'vasterbotten-norrbotten',
    cityLinks: [
      { key: 'umea', href: cityFilterHref('Umeå') },
      { key: 'skelleftea', href: cityFilterHref('Skellefteå') },
      { key: 'lulea', href: cityFilterHref('Luleå') },
      { key: 'kiruna', href: cityFilterHref('Kiruna') },
    ],
  },
] as const;

export function buildWesternNorthernSwedenResponse(
  copy: WesternNorthernSwedenCopy,
  locale: WesternNorthernSwedenHubResponse['locale'],
): WesternNorthernSwedenHubResponse {
  const parsedCopy = WesternNorthernSwedenPageCopy.parse(copy);
  const regions = westernNorthernSwedenRegions.map((region) => {
    const regionCopy = parsedCopy.regions[region.slug];
    return {
      slug: region.slug,
      name: regionCopy.name,
      description: regionCopy.description,
      cities: region.cityLinks.map((city) => {
        const cityCopy = regionCopy.cities[city.key];
        if (!cityCopy) {
          throw new Error(
            `Missing Western and Northern Sweden city copy: ${region.slug}.${city.key}`,
          );
        }
        return { label: cityCopy.label, href: city.href };
      }),
    };
  });

  return WesternNorthernSwedenHub.parse({
    locale,
    meta: parsedCopy.meta,
    hero: parsedCopy.hero,
    learnerGuide: {
      ...parsedCopy.learnerGuide,
      steps: [
        parsedCopy.learnerGuide.steps.choose,
        parsedCopy.learnerGuide.steps.compare,
        parsedCopy.learnerGuide.steps.practice,
      ],
    },
    regionNav: parsedCopy.regionNav,
    regions,
    cta: parsedCopy.cta,
    ui: parsedCopy.ui,
  });
}

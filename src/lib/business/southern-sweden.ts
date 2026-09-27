
import {
  type SouthernSwedenCopy,
  SouthernSwedenHub,
  type SouthernSwedenHubResponse,
  SouthernSwedenPageCopy,
} from '@/lib/contracts/southern-sweden';

const cityFilterHref = (city: string) => `/instructors?city=${encodeURIComponent(city)}`;

export const southernSwedenRegions = [
  {
    slug: 'skane',
    cityLinks: [
      { key: 'malmo', href: '/instructors/malmo' },
      { key: 'helsingborg', href: cityFilterHref('Helsingborg') },
      { key: 'lund', href: cityFilterHref('Lund') },
      { key: 'kristianstad', href: cityFilterHref('Kristianstad') },
      { key: 'ystad', href: cityFilterHref('Ystad') },
    ],
  },
  {
    slug: 'halland',
    cityLinks: [
      { key: 'halmstad', href: cityFilterHref('Halmstad') },
      { key: 'varberg', href: cityFilterHref('Varberg') },
      { key: 'falkenberg', href: cityFilterHref('Falkenberg') },
      { key: 'kungsbacka', href: cityFilterHref('Kungsbacka') },
    ],
  },
  {
    slug: 'blekinge',
    cityLinks: [
      { key: 'karlskrona', href: cityFilterHref('Karlskrona') },
      { key: 'karlshamn', href: cityFilterHref('Karlshamn') },
      { key: 'ronneby', href: cityFilterHref('Ronneby') },
      { key: 'solvesborg', href: cityFilterHref('Sölvesborg') },
    ],
  },
  {
    slug: 'smaland',
    cityLinks: [
      { key: 'jonkoping', href: cityFilterHref('Jönköping') },
      { key: 'vaxjo', href: cityFilterHref('Växjö') },
      { key: 'kalmar', href: cityFilterHref('Kalmar') },
      { key: 'varnamo', href: cityFilterHref('Värnamo') },
      { key: 'ljungby', href: cityFilterHref('Ljungby') },
    ],
  },
] as const;

export function buildSouthernSwedenResponse(
  copy: SouthernSwedenCopy,
  locale: SouthernSwedenHubResponse['locale'],
): SouthernSwedenHubResponse {
  const parsedCopy = SouthernSwedenPageCopy.parse(copy);
  const regions = southernSwedenRegions.map((region) => {
    const regionCopy = parsedCopy.regions[region.slug];
    return {
      slug: region.slug,
      name: regionCopy.name,
      description: regionCopy.description,
      cities: region.cityLinks.map((city) => {
        const cityCopy = regionCopy.cities[city.key];
        if (!cityCopy) {
          throw new Error(`Missing Southern Sweden city copy: ${region.slug}.${city.key}`);
        }
        return { label: cityCopy.label, href: city.href };
      }),
    };
  });

  return SouthernSwedenHub.parse({
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

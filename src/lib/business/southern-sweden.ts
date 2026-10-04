
import {
  type SouthernSwedenCopy,
  SouthernSwedenHub,
  type SouthernSwedenHubResponse,
  SouthernSwedenPageCopy,
} from '@/lib/contracts/southern-sweden';

const se = (slug: string) => `/locations/se/${slug}`;

export const southernSwedenRegions = [
  {
    slug: 'skane',
    cityLinks: [
      { key: 'malmo', href: se('malmo') },
      { key: 'helsingborg', href: se('helsingborg') },
      { key: 'lund', href: se('lund') },
      { key: 'kristianstad', href: se('kristianstad') },
      { key: 'ystad', href: se('ystad') },
    ],
  },
  {
    slug: 'halland',
    cityLinks: [
      { key: 'halmstad', href: se('halmstad') },
      { key: 'varberg', href: se('varberg') },
      { key: 'falkenberg', href: se('falkenberg') },
      { key: 'kungsbacka', href: se('kungsbacka') },
    ],
  },
  {
    slug: 'blekinge',
    cityLinks: [
      { key: 'karlskrona', href: se('karlskrona') },
      { key: 'karlshamn', href: se('karlshamn') },
      { key: 'ronneby', href: se('ronneby') },
      { key: 'solvesborg', href: se('solvesborg') },
    ],
  },
  {
    slug: 'smaland',
    cityLinks: [
      { key: 'jonkoping', href: se('jonkoping') },
      { key: 'vaxjo', href: se('vaxjo') },
      { key: 'kalmar', href: se('kalmar') },
      { key: 'varnamo', href: se('varnamo') },
      { key: 'ljungby', href: se('ljungby') },
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

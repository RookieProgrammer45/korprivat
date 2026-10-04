
import {
  type WesternNorthernSwedenCopy,
  WesternNorthernSwedenHub,
  type WesternNorthernSwedenHubResponse,
  WesternNorthernSwedenPageCopy,
} from '@/lib/contracts/western-northern-sweden';

const se = (slug: string) => `/locations/se/${slug}`;

export const westernNorthernSwedenRegions = [
  {
    slug: 'vastra-gotaland',
    cityLinks: [
      { key: 'goteborg', href: se('goteborg') },
      { key: 'boras', href: se('boras') },
      { key: 'trollhattan', href: se('trollhattan') },
      { key: 'skovde', href: se('skovde') },
    ],
  },
  {
    slug: 'varmland',
    cityLinks: [
      { key: 'karlstad', href: se('karlstad') },
      { key: 'arvika', href: se('arvika') },
      { key: 'kristinehamn', href: se('kristinehamn') },
    ],
  },
  {
    slug: 'gavleborg-vasternorrland',
    cityLinks: [
      { key: 'gavle', href: se('gavle') },
      { key: 'sundsvall', href: se('sundsvall') },
      { key: 'hudiksvall', href: se('hudiksvall') },
      { key: 'ornskoldsvik', href: se('ornskoldsvik') },
    ],
  },
  {
    slug: 'vasterbotten-norrbotten',
    cityLinks: [
      { key: 'umea', href: se('umea') },
      { key: 'skelleftea', href: se('skelleftea') },
      { key: 'lulea', href: se('lulea') },
      { key: 'kiruna', href: se('kiruna') },
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

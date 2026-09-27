
import { z } from 'zod';

export const SouthernSwedenLocale = z.enum(['sv', 'en']);
export const SouthernSwedenRegionSlug = z.enum(['skane', 'halland', 'blekinge', 'smaland']);

const CityCopy = z.object({ label: z.string().min(1) });
const RegionCopy = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  cities: z.record(z.string(), CityCopy),
});

export const SouthernSwedenPageCopy = z.object({
  meta: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    ogTitle: z.string().min(1),
    ogDescription: z.string().min(1),
  }),
  hero: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: z.string().min(1),
    secondaryCta: z.string().min(1),
  }),
  learnerGuide: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    steps: z.object({
      choose: z.object({ title: z.string().min(1), body: z.string().min(1) }),
      compare: z.object({ title: z.string().min(1), body: z.string().min(1) }),
      practice: z.object({ title: z.string().min(1), body: z.string().min(1) }),
    }),
  }),
  regionNav: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    jumpLabel: z.string().min(1),
  }),
  regions: z.object({
    skane: RegionCopy,
    halland: RegionCopy,
    blekinge: RegionCopy,
    smaland: RegionCopy,
  }),
  cta: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    button: z.string().min(1),
    ariaLabel: z.string().min(1),
  }),
  ui: z.object({
    loading: z.string().min(1),
    error: z.string().min(1),
    retry: z.string().min(1),
    cityListingLabel: z.string().min(1),
    cityLinkPrefix: z.string().min(1),
    regionNavLabel: z.string().min(1),
    backToRegions: z.string().min(1),
    directoryLinkPrefix: z.string().min(1),
  }),
});

const Hero = SouthernSwedenPageCopy.shape.hero;
const LearnerGuide = SouthernSwedenPageCopy.shape.learnerGuide;
const RegionNav = SouthernSwedenPageCopy.shape.regionNav;
const Cta = SouthernSwedenPageCopy.shape.cta;
const Ui = SouthernSwedenPageCopy.shape.ui;

export const SouthernSwedenHub = z.object({
  locale: SouthernSwedenLocale,
  meta: SouthernSwedenPageCopy.shape.meta,
  hero: Hero,
  learnerGuide: LearnerGuide.extend({
    steps: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).length(3),
  }),
  regionNav: RegionNav,
  regions: z
    .array(
      z.object({
        slug: SouthernSwedenRegionSlug,
        name: z.string().min(1),
        description: z.string().min(1),
        cities: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })),
      }),
    )
    .length(4),
  cta: Cta,
  ui: Ui,
});

export type SouthernSwedenCopy = z.infer<typeof SouthernSwedenPageCopy>;
export type SouthernSwedenHubResponse = z.infer<typeof SouthernSwedenHub>;

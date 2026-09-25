// @polsia:user-owned — shared contract for the public Western and Northern Sweden SEO hub.

import { z } from 'zod';

export const WesternNorthernSwedenLocale = z.enum(['sv', 'en']);
export const WesternNorthernSwedenRegionSlug = z.enum([
  'vastra-gotaland',
  'varmland',
  'gavleborg-vasternorrland',
  'vasterbotten-norrbotten',
]);

const CityCopy = z.object({ label: z.string().min(1) });
const RegionCopy = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  cities: z.record(z.string(), CityCopy),
});

export const WesternNorthernSwedenPageCopy = z.object({
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
    'vastra-gotaland': RegionCopy,
    varmland: RegionCopy,
    'gavleborg-vasternorrland': RegionCopy,
    'vasterbotten-norrbotten': RegionCopy,
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

const Hero = WesternNorthernSwedenPageCopy.shape.hero;
const LearnerGuide = WesternNorthernSwedenPageCopy.shape.learnerGuide;
const RegionNav = WesternNorthernSwedenPageCopy.shape.regionNav;
const Cta = WesternNorthernSwedenPageCopy.shape.cta;
const Ui = WesternNorthernSwedenPageCopy.shape.ui;

export const WesternNorthernSwedenHub = z.object({
  locale: WesternNorthernSwedenLocale,
  meta: WesternNorthernSwedenPageCopy.shape.meta,
  hero: Hero,
  learnerGuide: LearnerGuide.extend({
    steps: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).length(3),
  }),
  regionNav: RegionNav,
  regions: z
    .array(
      z.object({
        slug: WesternNorthernSwedenRegionSlug,
        name: z.string().min(1),
        description: z.string().min(1),
        cities: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })),
      }),
    )
    .length(4),
  cta: Cta,
  ui: Ui,
});

export type WesternNorthernSwedenCopy = z.infer<typeof WesternNorthernSwedenPageCopy>;
export type WesternNorthernSwedenHubResponse = z.infer<typeof WesternNorthernSwedenHub>;

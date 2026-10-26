// framework-owned). Applied only when the deploy is indexable (SEO_INDEXABLE).
//
// The SHAPE (types) is framework-owned in src/lib/llms.ts; here you declare the
// VALUE. The `## Pages` list is generated for you from the public
// routes in src/lib/nav.ts + src/lib/seo-routes.ts — enrich it here with an
// intro, per-page descriptions, extra curated sections, and an `## Optional`
// section. Example:
//
//   export const llmsConfig: LlmsConfig = {
//     intro: 'Acme helps teams ship faster with a hosted CI pipeline.',
//     pageDescriptions: {
//       '/': 'Product overview and sign-up.',
//       '/pricing': 'Plans, limits, and pricing.',
//     },
//     sections: [
//       {
//         title: 'Docs',
//         links: [
//           { label: 'API reference', href: '/docs/api', description: 'REST endpoints.' },
//           { label: 'Status', href: 'https://status.acme.com' }, // external URL, kept as-is
//         ],
//       },
//     ],
//     optional: [{ label: 'Changelog', href: '/changelog' }],
//   };
import type { LlmsConfig } from '@/lib/llms';

export const llmsConfig: LlmsConfig = {
  intro:
    'DriveLinkUp is a Sweden-first marketplace that lists driving schools and instructors. It is not a driving school, licensing authority, or government service. Learners discover and compare listings for free (0% learner fee). A listing is not a booking authorization. Instant booking appears only where the school granted that path. School-affiliated bookings pay 8% commission after completed service. Instructors collect payment only through a driving school they belong to. Handledare / övningskörning is a separate legal path, not a school listing.',
  pageDescriptions: {
    '/': 'Marketplace for comparing driving-school listings, published prices, availability, and lessons in Sweden. Displayed times are not a reserved lesson.',
    '/instructors':
      'Browse and compare driving-school listings by licence category, city, language, price, availability, and booking policy.',
    '/locations':
      'Nordic location directory: Sweden live for discovery; Norway, Denmark, Finland, and Iceland expansion hubs.',
    '/locations/se':
      'Sweden country hub with län and city pages for driving-school discovery.',
    '/locations/se/stockholm':
      'City hub for driving-school listings in Stockholm with pricing context and FAQ.',
    '/locations/se/goteborg': 'City hub for driving-school listings in Gothenburg (Göteborg).',
    '/locations/se/malmo': 'City hub for driving-school listings in Malmö and Skåne.',
    '/pricing':
      'Learner booking is free of marketplace fees. Schools pay 8% after completion. Instructors collect payment only through a driving school they belong to.',
    '/faq':
      'Answers about directory listings, requests, availability, cancellations, and the separate Swedish handledare path.',
    '/for-instructors':
      'Information for driving schools about listings, school-controlled prices, and post-completion commission. Listing is not an endorsement.',
    '/for-skolor':
      'School onboarding: publish prices and availability. A listing is not a booking authorization.',
    '/southern-sweden':
      'A bilingual guide to driving-school listings across Skåne, Halland, Blekinge, and Småland, with links to city listings.',
    '/western-northern-sweden':
      'A bilingual guide to driving-school listings across Västra Götaland, Värmland, Gävleborg, Västernorrland, Västerbotten, and Norrbotten.',
    '/handledare':
      'A Swedish explainer for private handledare and övningskörning. Handledare are distinct from driving schools and are not marketplace school listings.',
    '/blog': 'Guides for learners: costs, handledare, and choosing a traffic school in Sweden.',
    '/om-oss':
      'About DriveLinkUp: why published prices appear before checkout, how the marketplace connects schools, certified instructors and learners. DriveLinkUp is a startup founded in Stockholm in 2026.',
    '/terms':
      'Terms of service: booking and payment via Stripe with funds released after completed lessons, cancellation rules set by each school, 8% school commission, instructor payment only through a school, and account rules.',
  },
};

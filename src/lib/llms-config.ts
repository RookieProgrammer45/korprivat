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
    'DriveLinkUp is a Sweden-first catalog of driving schools. It is not a driving school, licensing authority, or government service. Learners compare listings and published prices for free, then contact the school. DriveLinkUp does not take lesson payments. Instructors appear only as part of a school. Handledare / övningskörning is a separate legal path, not a school listing.',
  pageDescriptions: {
    '/': 'Catalog for comparing driving-school listings and published prices in Sweden.',
    '/instructors':
      'Browse and compare driving-school listings by licence category, city, language and published price.',
    '/locations':
      'Nordic location directory: Sweden live for discovery; Norway, Denmark, Finland, and Iceland expansion hubs.',
    '/locations/se':
      'Sweden country hub with län and city pages for driving-school discovery.',
    '/locations/se/stockholm':
      'City hub for driving-school listings in Stockholm with pricing context and FAQ.',
    '/locations/se/goteborg': 'City hub for driving-school listings in Gothenburg (Göteborg).',
    '/locations/se/malmo': 'City hub for driving-school listings in Malmö and Skåne.',
    '/pricing':
      'A catalog listing is free. DriveLinkUp does not add a learner fee. Instructors collect payment only through a driving school they belong to.',
    '/faq':
      'Answers about directory listings, published prices, and the separate Swedish handledare path.',
    '/for-instructors':
      'Information for driving schools about listings and school-controlled prices. Listing is not an endorsement.',
    '/for-skolor':
      'School onboarding: publish the school and its prices so learners can compare and contact you.',
    '/southern-sweden':
      'A bilingual guide to driving-school listings across Skåne, Halland, Blekinge, and Småland, with links to city listings.',
    '/western-northern-sweden':
      'A bilingual guide to driving-school listings across Västra Götaland, Värmland, Gävleborg, Västernorrland, Västerbotten, and Norrbotten.',
    '/handledare':
      'A Swedish explainer for private handledare and övningskörning. Handledare are distinct from driving schools and are not marketplace school listings.',
    '/blog': 'Guides for learners: costs, handledare, and choosing a traffic school in Sweden.',
    '/blog/korkort-b-steg-for-steg':
      'Swedish guide to category B: learner permit, risk education, theory test, driving test, and how to compare published school prices.',
    '/blog/kunskapsprov-korkort-b':
      'Swedish guide to the category B theory test at Trafikverket: learner permit, risk education, scoring, validity, and published school prices.',
    '/om-oss':
      'About DriveLinkUp: a catalog of driving schools. Published prices are visible on the listing. Instructors teach through a school. Founded in Stockholm in 2026.',
    '/terms':
      'Terms of service: directory listings, instructor payment only through a school, and account rules.',
  },
};

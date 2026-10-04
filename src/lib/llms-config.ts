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
    'DriveLinkUp is a Sweden-first marketplace for authorized driving schools. Learners discover, compare, and book for free (0% learner fee). School-affiliated bookings pay 8% commission after completed service; independent instructors pay 10%. Handledare / övningskörning is a separate legal path, not a school listing.',
  pageDescriptions: {
    '/': 'Marketplace for comparing authorized driving schools, their published prices, availability, and driving lessons in Sweden.',
    '/instructors':
      'Browse and compare authorized driving-school listings by licence category, city, language, price, availability, and booking policy.',
    '/locations':
      'Nordic location directory: Sweden live for booking; Norway, Denmark, Finland, and Iceland expansion hubs.',
    '/locations/se':
      'Sweden country hub with län and city pages for authorized driving-school discovery.',
    '/locations/se/stockholm':
      'City hub for authorized driving schools in Stockholm with booking, pricing context, and FAQ.',
    '/locations/se/goteborg':
      'City hub for authorized driving schools in Gothenburg (Göteborg).',
    '/locations/se/malmo': 'City hub for authorized driving schools in Malmö and Skåne.',
    '/pricing':
      'Learner booking is free of marketplace fees. Schools pay 8% after completion; independent instructors 10%.',
    '/faq':
      'Answers about authorized schools, free learner booking, school-controlled availability, cancellations, and the separate Swedish handledare path.',
    '/for-instructors':
      'Information for authorized driving schools about qualified, measurable bookings, school-controlled prices, and post-completion commission.',
    '/for-skolor':
      'School onboarding: publish prices and availability, receive measurable bookings, 8% after completion.',
    '/southern-sweden':
      'A bilingual guide to authorized driving-school listings and lessons across Skåne, Halland, Blekinge, and Småland, with links to exact-city listings.',
    '/western-northern-sweden':
      'A bilingual guide to authorized driving-school listings and lessons across Västra Götaland, Värmland, Gävleborg, Västernorrland, Västerbotten, and Norrbotten, with links to exact-city listings.',
    '/handledare':
      'A Swedish legal explainer for private handledare and övningskörning. Handledare are distinct from authorized driving schools and are not marketplace school listings.',
    '/blog': 'Guides for learners: costs, handledare, and choosing a traffic school in Sweden.',
  },
};

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
    'DriveLinkUp is a Booking.com-style marketplace for authorized driving schools in Sweden. Learners can discover, compare, and book for free; schools control their published prices and availability and pay 10% of attributable booking value only after completed service. DriveLinkUp does not add a separate learner fee.',
  pageDescriptions: {
    '/': 'Marketplace for comparing authorized driving schools, their published prices, availability, and driving lessons in Sweden.',
    '/instructors':
      'Browse and compare authorized driving-school listings by licence category, city, language, price, availability, and booking policy.',
    '/pricing':
      'How learner-free discovery and booking works, and how authorized schools pay a 10% commission only after completed service.',
    '/faq':
      'Answers about authorized schools, free learner booking, school-controlled availability, cancellations, and the separate Swedish handledare path.',
    '/for-instructors':
      'Information for authorized driving schools about qualified, measurable bookings, school-controlled prices, and post-completion commission.',
    '/southern-sweden':
      'A bilingual guide to authorized driving-school listings and lessons across Skåne, Halland, Blekinge, and Småland, with links to exact-city listings.',
    '/western-northern-sweden':
      'A bilingual guide to authorized driving-school listings and lessons across Västra Götaland, Värmland, Gävleborg, Västernorrland, Västerbotten, and Norrbotten, with links to exact-city listings.',
    '/handledare':
      'A Swedish legal explainer for private handledare and övningskörning. Handledare are distinct from authorized driving schools and are not marketplace school listings.',
  },
};

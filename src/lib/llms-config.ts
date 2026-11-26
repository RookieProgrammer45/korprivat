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
    'DriveLinkUp is a Sweden-first catalogue of driving schools, heavy-vehicle schools, published car prices, spare parts a shop published for a car owner or a workshop, and vehicle-inspection prices a station or an authority published. It is not a driving school, a parts shop, an inspection station, a licensing authority, or a government service. Anyone can compare the published price and specifications for free. DriveLinkUp does not sell the part, does not book the inspection, and does not take lesson payments. A listing is not a verified permit. A country appears in the inspection catalogue only when a price was published. Handledare / övningskörning is a separate legal path, not a school listing.',
  pageDescriptions: {
    '/': 'Compare driving schools, heavy-vehicle schools, published car prices, and spare parts a shop published for a car owner or a workshop.',
    '/reservdelar':
      'Published spare-part and accessory prices from the shop’s own page. Filter by car owner or workshop, and by the seller’s country. Currencies stay in separate groups.',
    '/besiktning':
      'Published vehicle-inspection prices. A country appears when the station or the authority published the amount. A maximum is the legal cap, not the price every garage charges. DriveLinkUp does not book the inspection.',
    '/tung-trafik':
      'Heavy-vehicle driving schools whose source listed a truck or bus licence class. A school name alone does not make it a truck school.',
    '/bilhandlare':
      'Published car prices and specifications from the dealer’s own page. DriveLinkUp does not sell the car.',
    '/locations':
      'Nordic location directory: Sweden live for discovery; Norway, Denmark, Finland, and Iceland expansion hubs.',
    '/locations/se': 'Sweden country hub with län and city pages for driving-school discovery.',
    '/locations/se/stockholm':
      'City hub for driving-school listings in Stockholm with pricing context and FAQ.',
    '/locations/se/goteborg': 'City hub for driving-school listings in Gothenburg (Göteborg).',
    '/locations/se/malmo': 'City hub for driving-school listings in Malmö and Skåne.',
    '/pricing':
      'A catalog listing is free. DriveLinkUp does not add a fee. Payment for the lesson is arranged with the school.',
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
    '/blog':
      'Guides for learners: category B in Malmö and Gothenburg, driving lessons, the learner permit, risk education, the driving test, theory test, costs, handledare, and choosing a traffic school in Sweden.',
    '/blog/korkort-b-malmo':
      'Swedish guide to category B in Malmö: learner permit, traffic-school lessons, risk education, Trafikverket theory and driving tests at Cederströmsgatan 1, foreign-licence readers, and published school prices.',
    '/blog/korkort-b-goteborg':
      'Swedish guide to category B in Gothenburg: learner permit, traffic-school lessons, risk education, Trafikverket theory and driving tests at Hisingen, Högsbo and Partille, foreign-licence readers, and published school prices.',
    '/blog/korlektion-korkort-b':
      'Swedish guide to a category B driving lesson: learner permit, a traffic-school permit versus a catalog listing, published prices in Stockholm, Gothenburg, Malmö and Lund, and readers who already drive in another country.',
    '/blog/korkortstillstand-korkort-b':
      'Swedish guide to the category B learner permit: group 1 application, vision certificate, five-year validity, foreign-licence readers, and published school prices.',
    '/blog/riskutbildning-korkort-b':
      'Swedish guide to mandatory category B risk education: riskettan, skidpad (halkbana), validity before the theory and driving tests, foreign-licence readers, and published school prices.',
    '/blog/korprov-korkort-b':
      'Swedish guide to the category B driving test at Trafikverket: learner permit, risk education, theory-test validity, safety check, and published school prices.',
    '/blog/korkort-b-steg-for-steg':
      'Swedish guide to category B: learner permit, risk education, theory test, driving test, and how to compare published school prices.',
    '/blog/kunskapsprov-korkort-b':
      'Swedish guide to the category B theory test at Trafikverket: learner permit, risk education, scoring, validity, and published school prices.',
    '/om-oss':
      'About DriveLinkUp: a catalog of driving schools. Published prices are visible on the listing. Founded in Stockholm in 2026.',
    '/terms': 'Terms of service: directory listings, school-arranged payment, and account rules.',
  },
};

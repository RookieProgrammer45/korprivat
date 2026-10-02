//
// Labels are translation keys (resolved by the SiteNav island via
// `useTranslations('common')`) so the same list renders SV or EN depending on
// the active locale. The stable English label is used by non-localized
// consumers such as the framework's /llms.txt renderer.

export type NavGroup = 'primary' | 'secondary' | 'footer';

export interface NavItem {
  /** Translation key under `common.nav.*`. */
  labelKey:
    | 'nav.findProvider'
    | 'nav.howItWorks'
    | 'nav.licenceCategories'
    | 'nav.drivingInstructor'
    | 'nav.drivingSchool'
    | 'nav.forSchoolsMenu'
    | 'nav.getStarted'
    | 'nav.faq'
    | 'nav.contactUs'
    | 'nav.contact'
    | 'nav.signIn'
    | 'nav.signOut'
    | 'nav.dashboard'
    | 'nav.resources'
    | 'nav.blog'
    | 'nav.profile'
    | 'nav.cityStockholm'
    | 'nav.cityGoteborg'
    | 'nav.cityMalmo'
    | 'nav.cityUppsala'
    | 'nav.cityVasteras'
    | 'nav.privacy'
    | 'nav.pricing'
    | 'nav.paymentMethods'
    | 'nav.handledare'
    | 'nav.southernSweden'
    | 'nav.westernNorthernSweden';
  /** Stable English label for non-localized consumers. */
  label: string;
  /** App route, e.g. '/' or '/dashboard'. */
  href: string;
  /** Where it renders: top-nav 'primary'/'secondary', or 'footer'. */
  group: NavGroup;
  /** Group `primary` items into a dropdown: items sharing a `menu` value collapse
   *  into one "<menu> ⌄" top-bar slot (e.g. `menu: 'Resources'` on Blog/Docs/
   *  Changelog). Keeps the bar short. Ignored for 'secondary'/'footer'. */
  menu?: string;
  /** When true, render only if a session exists (see site-nav.tsx). */
  requiresAuth?: boolean;
  /** When true, hide once a session exists (acquisition CTAs / marketing-only). */
  hideWhenAuthenticated?: boolean;
  /** Sort key within a group (ascending); unordered items fall to the end. */
  order?: number;
}

// Keep the bar short: ~3-5 primary slots, group the tail with `menu`, push the
// rest to 'footer' (SiteNav overflows extras into a "More" dropdown). Example:
//   { labelKey: 'nav.faq',        href: '/faq',              group: 'primary', order: 1 },
//   { labelKey: 'nav.contactUs', href: 'mailto:…',          group: 'secondary' },
export const navItems: NavItem[] = [
  {
    label: 'Find driving schools',
    labelKey: 'nav.findProvider',
    href: '/instructors',
    group: 'primary',
    order: 1,
  },
  {
    label: 'How it works',
    labelKey: 'nav.howItWorks',
    href: '/#how',
    group: 'primary',
    order: 2,
    hideWhenAuthenticated: true,
  },
  // Profile + Dashboard live in the signed-in AuthNav menu (avatar), not the
  // primary bar — keeps marketing chrome short once a session exists.
  {
    label: "I'm a driving instructor",
    labelKey: 'nav.drivingInstructor',
    href: '/signup?role=instructor',
    group: 'secondary',
    order: 0,
    hideWhenAuthenticated: true,
  },
  {
    label: 'I run a driving school',
    labelKey: 'nav.drivingSchool',
    href: '/for-skolor',
    group: 'secondary',
    order: 1,
    hideWhenAuthenticated: true,
  },
  {
    label: 'Get started',
    labelKey: 'nav.getStarted',
    href: '/signup',
    group: 'secondary',
    order: 2,
    hideWhenAuthenticated: true,
  },
  { label: 'FAQ', labelKey: 'nav.faq', href: '/faq', group: 'footer', order: 0 },
  { label: 'Pricing', labelKey: 'nav.pricing', href: '/pricing', group: 'footer', order: 1 },
  { label: 'Contact', labelKey: 'nav.contact', href: '/contact', group: 'footer', order: 1 },
  { label: 'Privacy', labelKey: 'nav.privacy', href: '/privacy', group: 'footer', order: 2 },
  { label: 'Journal', labelKey: 'nav.blog', href: '/blog', group: 'footer', order: 3 },
  {
    label: 'Handledare guidance',
    labelKey: 'nav.handledare',
    href: '/handledare',
    group: 'footer',
    order: 4,
  },
  {
    label: 'Stockholm',
    labelKey: 'nav.cityStockholm',
    href: '/instructors/stockholm',
    group: 'footer',
    order: 4,
  },
  {
    label: 'Gothenburg',
    labelKey: 'nav.cityGoteborg',
    href: '/instructors/goteborg',
    group: 'footer',
    order: 5,
  },
  {
    label: 'Malmö',
    labelKey: 'nav.cityMalmo',
    href: '/instructors/malmo',
    group: 'footer',
    order: 6,
  },
  {
    label: 'Uppsala',
    labelKey: 'nav.cityUppsala',
    href: '/instructors/uppsala',
    group: 'footer',
    order: 7,
  },
  {
    label: 'Västerås',
    labelKey: 'nav.cityVasteras',
    href: '/instructors/vasteras',
    group: 'footer',
    order: 8,
  },
  // Authed-only: "Saved details" / "payment methods" page. Lives in the
  // footer because it requires a session — the global footer
  // SiteNav renders it via useSession; non-authed visitors will see it
  // ghost-rendered but the link is harmless on the public marketing
  // pages. Better-auth auto-redirects unauthorised requests to /login.
  {
    label: 'Payment methods',
    labelKey: 'nav.paymentMethods',
    href: '/dashboard/student/payment-methods',
    group: 'footer',
    order: 9,
    requiresAuth: true,
  },
  {
    label: 'Southern Sweden',
    labelKey: 'nav.southernSweden',
    href: '/southern-sweden',
    group: 'footer',
    order: 10,
  },
  {
    label: 'Western & Northern Sweden',
    labelKey: 'nav.westernNorthernSweden',
    href: '/western-northern-sweden',
    group: 'footer',
    order: 11,
  },
];

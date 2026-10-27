'use client';

// Site footer — mounted once in the root layout, rendered on every page that
// doesn't own its chrome (see shell-mode.ts). Layout inspired by Magic UI's
// footer-01: brand + CTA block on the left, four link columns on the right,
// popular-city chips, and a bottom bar with contact + copyright. Labels are
// translation keys under `common.*` so the footer renders SV or EN with the
// active locale, mirroring SiteNav.

import { ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useIsAuthenticated } from '@/components/custom/site-nav';
import type { NavItem } from '@/lib/nav';
import { isFocusedShellPath } from '@/lib/shell-mode';
import { siteName } from '@/lib/site';

type FooterLabelKey = NavItem['labelKey'];

interface FooterLink {
  readonly labelKey: FooterLabelKey;
  readonly href: string;
  readonly requiresAuth?: boolean;
}

interface FooterColumn {
  readonly titleKey:
    | 'footer.columnProduct'
    | 'footer.columnCompany'
    | 'footer.columnResources'
    | 'footer.columnLegal';
  readonly items: readonly FooterLink[];
}

const COLUMNS: readonly FooterColumn[] = [
  {
    titleKey: 'footer.columnProduct',
    items: [
      { labelKey: 'nav.findProvider', href: '/instructors' },
      { labelKey: 'nav.pricing', href: '/pricing' },
      { labelKey: 'nav.drivingSchool', href: '/for-skolor' },
    ],
  },
  {
    titleKey: 'footer.columnCompany',
    items: [
      { labelKey: 'nav.about', href: '/om-oss' },
      { labelKey: 'nav.contact', href: '/contact' },
      { labelKey: 'nav.blog', href: '/blog' },
    ],
  },
  {
    titleKey: 'footer.columnResources',
    items: [
      { labelKey: 'nav.faq', href: '/faq' },
      { labelKey: 'nav.handledare', href: '/handledare' },
      { labelKey: 'nav.locations', href: '/locations' },
      { labelKey: 'nav.southernSweden', href: '/southern-sweden' },
      { labelKey: 'nav.westernNorthernSweden', href: '/western-northern-sweden' },
    ],
  },
  {
    titleKey: 'footer.columnLegal',
    items: [
      { labelKey: 'nav.privacy', href: '/privacy' },
      { labelKey: 'nav.terms', href: '/terms' },
      {
        labelKey: 'nav.paymentMethods',
        href: '/dashboard/student/payment-methods',
        requiresAuth: true,
      },
    ],
  },
];

const CITY_LINKS: readonly FooterLink[] = [
  { labelKey: 'nav.cityStockholm', href: '/locations/se/stockholm' },
  { labelKey: 'nav.cityGoteborg', href: '/locations/se/goteborg' },
  { labelKey: 'nav.cityMalmo', href: '/locations/se/malmo' },
  { labelKey: 'nav.cityUppsala', href: '/locations/se/uppsala' },
  { labelKey: 'nav.cityVasteras', href: '/locations/se/vasteras' },
];

// Public support inbox. Product mail stays on Resend; outreach stays on
// marketing@drivelinkup.com. Privacy and terms use this same address.
// Social links are only profiles that resolve to DriveLinkUp. Do not add a
// network until its public URL is known.
const CONTACT_EMAIL = 'support@drivelinkup.com';

const SOCIAL_LINKS = [
  { href: 'https://x.com/Drivelinkup', labelKey: 'footer.socialX' as const },
  { href: 'https://www.instagram.com/drivelinkup', labelKey: 'footer.socialInstagram' as const },
  {
    href: 'https://www.facebook.com/profile.php?id=61595254779697',
    labelKey: 'footer.socialFacebook' as const,
  },
  {
    href: 'https://www.linkedin.com/company/drivelinkup',
    labelKey: 'footer.socialLinkedin' as const,
  },
  { href: 'https://www.tiktok.com/@drivelinkup_', labelKey: 'footer.socialTiktok' as const },
  {
    href: 'https://www.reddit.com/user/DriveLinkup_app/',
    labelKey: 'footer.socialReddit' as const,
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  // Hooks before the focused-shell early-return — same soft-nav rule as SiteNav.
  const isAuthenticated = useIsAuthenticated();
  const t = useTranslations('common');

  if (isFocusedShellPath(pathname)) {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <footer className="dlu-footer">
      <div className="dlu-footer-inner">
        <div className="dlu-footer-top">
          <div className="dlu-footer-brand">
            <Link href="/" aria-label={siteName} className="dlu-footer-logo">
              {/* biome-ignore lint/performance/noImgElement: statisk brand-logo SVG - next/image lar ingen vinst */}
              <img
                src="/brand/logo-black.svg"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px]"
              />
              <span className="font-display">{siteName}</span>
            </Link>
            <p className="dlu-footer-headline">{t('footer.headline')}</p>
            <p className="dlu-footer-sub">{t('footer.sub')}</p>
            <Link href="/signup" className="dlu-footer-cta">
              {t('footer.cta')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <nav aria-label={t('nav.footer')} className="dlu-footer-cols">
            {COLUMNS.map((column) => (
              <div key={column.titleKey} className="dlu-footer-col">
                <p className="dlu-footer-coltitle">{t(column.titleKey)}</p>
                <ul>
                  {column.items
                    .filter((item) => !item.requiresAuth || isAuthenticated)
                    .map((item) => (
                      <li key={item.href}>
                        <Link className="dlu-footer-link" href={item.href}>
                          {t(item.labelKey)}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="dlu-footer-cities">
          <span className="dlu-footer-cities-label">{t('footer.popularCities')}</span>
          {CITY_LINKS.map((city) => (
            <Link key={city.href} href={city.href} className="dlu-footer-citychip">
              {t(city.labelKey)}
            </Link>
          ))}
        </div>

        <div className="dlu-footer-bottom">
          <a
            className="dlu-footer-social"
            href={`mailto:${CONTACT_EMAIL}`}
            aria-label={t('footer.emailAria')}
          >
            <Mail className="size-4" aria-hidden />
            <span className="dlu-footer-email">{CONTACT_EMAIL}</span>
          </a>
          <nav aria-label={t('footer.socialNav')} className="dlu-footer-socials">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                className="dlu-footer-social"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </nav>
          <p className="dlu-footer-copy">{t('footer.copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}

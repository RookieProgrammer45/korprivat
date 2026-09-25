// @polsia:user-owned — global navigation rendered from src/lib/nav.ts.

'use client';

import { ChevronDown, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthNav } from '@/components/custom/auth-nav';
import { LanguageToggle } from '@/components/custom/language-toggle';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { signOut as signOutAction, useSession } from '@/lib/auth-client';

import { type NavGroup, type NavItem, navItems } from '@/lib/nav';
import { siteName } from '@/lib/site';
import { cn } from '@/lib/utils';

// Session seam — wired through better-auth's useSession. better-auth's hook
// returns `{ data, isPending }`; while pending we treat the user as logged out
// so privileged nav items render the brief "off" state until the cookie
// resolves. The role lives on `data.user` (NOT `data.session.user`, which is
// the Auth.js trap — `session` is the session RECORD, not a nested user).
function useIsAuthenticated(): boolean {
  const { data } = useSession();
  return Boolean(data?.user);
}

function visibleItems(group: NavGroup, isAuthenticated: boolean): NavItem[] {
  return navItems
    .filter((item) => item.group === group && (!item.requiresAuth || isAuthenticated))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.labelKey.localeCompare(b.labelKey),
    );
}

// Inline top-bar slots (a slot = one link OR one `menu` dropdown), capped so the
// bar can't grow wide. Kept here (not a sibling module) so a template upgrade
// re-stamps the whole nav as one user-owned file rather than seeding an orphan.
const MAX_PRIMARY_SLOTS = 5;

type NavSlot =
  | { readonly type: 'link'; readonly item: NavItem }
  | { readonly type: 'menu'; readonly labelKey: string; readonly items: readonly NavItem[] };

const itemOrder = (i: NavItem) => i.order ?? Number.MAX_SAFE_INTEGER;
const slotOrder = (s: NavSlot) =>
  s.type === 'link' ? itemOrder(s.item) : Math.min(...s.items.map(itemOrder));
const slotLabelKey = (s: NavSlot) => (s.type === 'link' ? s.item.labelKey : s.labelKey);

// Items sharing a `menu` collapse into one dropdown (at their earliest position);
// the rest stay links. Sorts by `order` then labelKey. `menu` is the raw bucket
// key — the user-facing dropdown title is the first item's labelKey so a single
// `Resources` key acts as a stable cross-locale group anchor.
function buildPrimarySlots(items: readonly NavItem[]): NavSlot[] {
  const links: NavSlot[] = [];
  const menus = new Map<string, NavItem[]>();
  for (const item of items) {
    if (item.menu) {
      const bucket = menus.get(item.menu);
      if (bucket) bucket.push(item);
      else menus.set(item.menu, [item]);
    } else {
      links.push({ type: 'link', item });
    }
  }
  const menuSlots: NavSlot[] = [...menus].map(([labelKey, its]) => ({
    type: 'menu',
    labelKey,
    items: [...its].sort(
      (a, b) => itemOrder(a) - itemOrder(b) || a.labelKey.localeCompare(b.labelKey),
    ),
  }));
  return [...links, ...menuSlots].sort(
    (a, b) => slotOrder(a) - slotOrder(b) || slotLabelKey(a).localeCompare(slotLabelKey(b)),
  );
}

// At most MAX_PRIMARY_SLOTS triggers render; the rest collapse into "More".
function splitPrimarySlots(slots: NavSlot[]): { inline: NavSlot[]; overflow: NavSlot[] } {
  if (slots.length <= MAX_PRIMARY_SLOTS) return { inline: slots, overflow: [] };
  return {
    inline: slots.slice(0, MAX_PRIMARY_SLOTS - 1),
    overflow: slots.slice(MAX_PRIMARY_SLOTS - 1),
  };
}

export function SiteNav() {
  const isAuthenticated = useIsAuthenticated();
  const tNav = useTranslations('common');
  // The brand links home, so drop a redundant '/' item from the rendered links.
  const primary = visibleItems('primary', isAuthenticated).filter((item) => item.href !== '/');
  const secondary = visibleItems('secondary', isAuthenticated);

  // Top-bar slots (links + `menu` dropdowns); `inline` renders, `overflow` → "More".
  const slots = buildPrimarySlots(primary);
  const { inline, overflow } = splitPrimarySlots(slots);
  const collapsedCount = primary.length + secondary.length;

  // Controlled so a drawer link both navigates AND dismisses the overlay; without
  // this the Sheet stays open over the new route after client-side navigation.
  const [open, setOpen] = React.useState(false);

  const pathname = usePathname();
  // Exact match for the root; segment-boundary match for everything else so
  // '/blog' highlights on '/blog/post' but '/' never matches every route.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const isSlotActive = (slot: NavSlot) =>
    slot.type === 'link' ? isActive(slot.item.href) : slot.items.some((i) => isActive(i.href));

  return (
    <header className="site-header site-header-shell sticky top-0 z-40 w-full border-b border-border bg-background shadow-sm">
      <nav
        aria-label={tNav('nav.primary')}
        className="mx-auto flex h-16 min-w-0 max-w-screen-xl items-center gap-3 px-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label={siteName}
          className="group mr-3 flex min-w-0 shrink-0 items-center text-foreground sm:mr-6"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 48"
            width={140}
            height={28}
            role="img"
            aria-labelledby="site-logo-title"
            className="site-header-wordmark h-6 w-auto max-w-full transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300"
          >
            <title id="site-logo-title">{siteName}</title>
            <g transform="translate(24 24)" fill="currentColor">
              <g transform="rotate(-45)">
                <path
                  fill-rule="evenodd"
                  d="M-14.5 -3.8 h29 a5.3 5.3 0 0 1 0 10.6 h-29 a5.3 5.3 0 0 1 0 -10.6 z M-10.7 -2.65 h21.4 a2.65 2.65 0 0 1 0 5.3 h-21.4 a2.65 2.65 0 0 1 0 -5.3 z"
                />
              </g>
              <rect x="-3.9" y="-3.9" width="7.8" height="7.8" transform="rotate(45)" />
              <g transform="rotate(45)">
                <path
                  fill-rule="evenodd"
                  d="M-14.5 -3.8 h29 a5.3 5.3 0 0 1 0 10.6 h-29 a5.3 5.3 0 0 1 0 -10.6 z M-10.7 -2.65 h21.4 a2.65 2.65 0 0 1 0 5.3 h-21.4 a2.65 2.65 0 0 1 0 -5.3 z"
                />
                <circle cx="0" cy="0" r="1.6" />
                <rect x="-0.55" y="-1.6" width="1.1" height="3.2" />
              </g>
              <circle cx="0" cy="0" r="1.6" transform="rotate(-45)" />
              <rect x="-0.55" y="-1.6" width="1.1" height="3.2" transform="rotate(-45)" />
            </g>
            <text
              x="62"
              y="33"
              font-family="Syne, Avenir Next, sans-serif"
              font-size="24"
              font-weight="600"
              letter-spacing="-0.48"
              fill="currentColor"
            >
              DriveLinkUp
            </text>
          </svg>
        </Link>

        {/* Desktop (md+): inline slots — direct links + `menu` dropdowns */}
        <div className="site-nav-links hidden min-w-0 items-center gap-1.5 md:flex">
          {inline.map((slot) =>
            slot.type === 'link' ? (
              <Button
                key={slot.item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  'nav-link rounded-md text-muted-foreground hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900',
                  isActive(slot.item.href) &&
                    'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
                )}
              >
                <Link
                  href={slot.item.href}
                  aria-current={isActive(slot.item.href) ? 'page' : undefined}
                >
                  {tNav(slot.item.labelKey)}
                </Link>
              </Button>
            ) : (
              <DropdownMenu key={`menu:${slot.labelKey}`}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'nav-link rounded-md text-muted-foreground hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900',
                      isSlotActive(slot) &&
                        'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
                    )}
                  >
                    {tNav(slot.labelKey)}
                    <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {slot.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                      >
                        {tNav(item.labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          )}

          {/* Overflow: everything past the cap collapses here so the bar can't grow wide */}
          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'nav-link rounded-md text-muted-foreground hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900',
                    overflow.some(isSlotActive) &&
                      'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
                  )}
                >
                  {tNav('nav.more')}
                  <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((slot, index) => {
                  // Separate a menu group from its neighbours, but not plain links.
                  const fenced =
                    index > 0 && (slot.type === 'menu' || overflow[index - 1]?.type === 'menu');
                  return (
                    <React.Fragment
                      key={slot.type === 'link' ? slot.item.href : `menu:${slot.labelKey}`}
                    >
                      {fenced && <DropdownMenuSeparator />}
                      {slot.type === 'link' ? (
                        <DropdownMenuItem asChild>
                          <Link
                            href={slot.item.href}
                            aria-current={isActive(slot.item.href) ? 'page' : undefined}
                          >
                            {tNav(slot.item.labelKey)}
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>{tNav(slot.labelKey)}</DropdownMenuLabel>
                          {slot.items.map((item) => (
                            <DropdownMenuItem key={item.href} asChild>
                              <Link
                                href={item.href}
                                aria-current={isActive(item.href) ? 'page' : undefined}
                              >
                                {tNav(item.labelKey)}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      )}
                    </React.Fragment>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right cluster: ml-auto pushes it right at every breakpoint */}
        <div className="site-nav-actions ml-auto flex min-w-0 items-center gap-1">
          {/* Desktop secondary buttons */}
          <div className="site-nav-secondary hidden items-center gap-1 md:flex">
            {secondary.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={item.labelKey === 'nav.getStarted' ? 'default' : 'outline'}
                size="sm"
                className="site-nav-cta"
              >
                <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                  {tNav(item.labelKey)}
                </Link>
              </Button>
            ))}
            <AuthNav />
          </div>

          {/* Always visible — language toggle sits immediately left of theme so
              the two cluster tightly on the right edge of the bar. */}
          <LanguageToggle />
          <ThemeToggle />

          {/* Mobile (below md): burger + drawer — only when there's something to collapse */}
          {collapsedCount > 0 && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="site-nav-mobile-trigger shrink-0 rounded-full border border-border bg-card md:hidden"
                >
                  <Menu />
                  <span className="sr-only">{tNav('nav.openMenu')}</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="site-nav-sheet flex min-w-0 flex-col"
              >
                <SheetHeader>
                  <SheetTitle className="text-left">{siteName}</SheetTitle>
                </SheetHeader>
                <nav
                  aria-label={tNav('nav.mobile')}
                  className="mt-6 flex min-w-0 flex-col gap-1 overflow-y-auto"
                >
                  {/* All slots, no overflow; a `menu` slot becomes a labeled section. */}
                  {slots.map((slot) =>
                    slot.type === 'link' ? (
                      <Button
                        key={slot.item.href}
                        asChild
                        variant="ghost"
                        className={cn(
                          'w-full justify-start',
                          isActive(slot.item.href) &&
                            'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
                        )}
                      >
                        <Link
                          href={slot.item.href}
                          aria-current={isActive(slot.item.href) ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {tNav(slot.item.labelKey)}
                        </Link>
                      </Button>
                    ) : (
                      <div key={`menu:${slot.labelKey}`} className="flex flex-col gap-1">
                        <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                          {tNav(slot.labelKey)}
                        </p>
                        {slot.items.map((item) => (
                          <Button
                            key={item.href}
                            asChild
                            variant="ghost"
                            className={cn(
                              'w-full justify-start pl-6',
                              isActive(item.href) &&
                                'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
                            )}
                          >
                            <Link
                              href={item.href}
                              aria-current={isActive(item.href) ? 'page' : undefined}
                              onClick={() => setOpen(false)}
                            >
                              {tNav(item.labelKey)}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ),
                  )}
                  {secondary.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-border pt-4">
                      {secondary.map((item) => (
                        <Button
                          key={item.href}
                          asChild
                          variant="secondary"
                          className="w-full justify-start"
                        >
                          <Link
                            href={item.href}
                            aria-current={isActive(item.href) ? 'page' : undefined}
                            onClick={() => setOpen(false)}
                          >
                            {tNav(item.labelKey)}
                          </Link>
                        </Button>
                      ))}
                      {/* AuthNav (mobile) — Sign in / Sign out reactive. */}
                      <AuthNavMobile onClose={() => setOpen(false)} />
                    </div>
                  )}
                </nav>
                {/* Footer of the mobile drawer — language toggle lives here so
                    every page can flip SV/EN from mobile, paralleling the
                    theme toggle (which is also designer-included in the
                    right-hand cluster on desktop). */}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                  <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {tNav('nav.language')}
                  </span>
                  <LanguageToggle />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const isAuthenticated = useIsAuthenticated();
  const tNav = useTranslations('common');
  const footer = visibleItems('footer', isAuthenticated);
  if (footer.length === 0) return null;

  return (
    <footer className="border-t border-border">
      <nav
        aria-label={tNav('nav.footer')}
        className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-1 px-4 py-6 text-sm"
      >
        {footer.map((item) => (
          <Button key={item.href} asChild variant="link" size="sm">
            <Link href={item.href}>{tNav(item.labelKey)}</Link>
          </Button>
        ))}
      </nav>
    </footer>
  );
}

// Mobile-drawer auth slot — wraps <AuthNav/> in a wide Button so it lands
// cleanly in the drawer's vertical layout.
function AuthNavMobile({ onClose }: { onClose: () => void }) {
  const t = useTranslations('common');
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = React.useState(false);
  if (isPending) return null;
  if (!session?.user) {
    return (
      <Button asChild variant="ghost" className="w-full justify-start">
        <Link href="/login">{t('nav.signIn')}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start text-muted-foreground hover:text-foreground"
      disabled={signingOut}
      aria-busy={signingOut}
      onClick={async () => {
        setSigningOut(true);
        try {
          await signOutAction();
          onClose();
          window.location.assign('/');
        } catch {
          setSigningOut(false);
          toast.error(t('nav.signOutError'));
        }
      }}
    >
      {signingOut ? t('nav.signingOut') : t('nav.signOut')}
    </Button>
  );
}

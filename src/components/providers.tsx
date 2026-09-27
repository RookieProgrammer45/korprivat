//
// App-wide Context providers go here. AppProviders is rendered by the root
// layout as an ancestor of the nav, page, footer and global mounts, so a Context
// added here reaches every client component (nav, hero, CTAs, modals, forms).
// Put a provider HERE — never scoped to a single leaf like a modal, or consumers
// elsewhere throw "useX must be used within YProvider" during server render.
//
// The i18n module wraps every page in <I18nProvider> (an async Server
// Component), so this wrapper is also a Server Component — do not add
// 'use client' here, or react-intl's `useTranslations` won't work in client
// islands. Add other (client) providers in their own 'use client' file and
// nest them inside <I18nProvider>, e.g. <AuthClientProviders>.

import { I18nProvider } from '@/i18n/i18n-provider';
import { bodyFont, displayFont } from '@/lib/fonts';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</div>
    </I18nProvider>
  );
}

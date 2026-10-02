import type { ReactNode } from 'react';
import { FocusedAppShell } from '@/components/custom/focused-app-shell';

/**
 * Onboarding routes own a minimal chrome (logo + language). Marketing SiteNav
 * is suppressed via `isFocusedShellPath` in site-nav.tsx.
 *
 * Child pages previously wrapped AuthShell — that chrome now lives here so we
 * do not stack two logos. Page content stays unchanged.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <FocusedAppShell contentClassName="max-w-lg justify-center">
      <div className="w-full min-w-0">{children}</div>
    </FocusedAppShell>
  );
}

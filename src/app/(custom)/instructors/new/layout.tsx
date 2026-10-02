import type { ReactNode } from 'react';
import { FocusedAppShell } from '@/components/custom/focused-app-shell';

/**
 * Instructor listing wizard — focused shell, not marketing nav.
 * Marketing SiteNav is suppressed for `/instructors/new` via shell-mode.
 */
export default function InstructorsNewLayout({ children }: { children: ReactNode }) {
  return (
    <FocusedAppShell contentClassName="max-w-2xl">
      {children}
    </FocusedAppShell>
  );
}

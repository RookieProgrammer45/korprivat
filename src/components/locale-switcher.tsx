// Auth and dashboard shells used to render every locale as a pill, which
// crowded the brand mark on mobile. They now use the same compact dropdown as
// the marketing nav.
'use client';

import { LanguageToggle } from '@/components/custom/language-toggle';

export function LocaleSwitcher() {
  return <LanguageToggle showCode />;
}

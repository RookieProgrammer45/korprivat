// @polsia:user-owned — HTML locale read by the framework layout for <html lang>/dir.
// The framework layout reads this static fallback; the i18n module's middleware
// resolves the ACTIVE locale from the NEXT_LOCALE cookie so a user who switches
// gets translated on every navigation. This file is the cookieless / crawler
// fallback only. Edit freely.

export const locale: { lang: string; dir: 'ltr' | 'rtl' } = {
  lang: 'sv',
  dir: 'ltr',
};

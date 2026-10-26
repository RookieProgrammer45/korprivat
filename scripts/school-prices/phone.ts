export type Phone = { display: string; e164: string; sourceUrl: string };

const PHONE = /(?<![\d+])(?:\+46\s?(?:\(0\)\s?)?|0)\d{1,3}(?:[\s\-–]?\d){5,8}(?![\d,.])/g;
// Trafikverket's customer service, often quoted on school sites.
const NOT_SCHOOL_PHONES = new Set(['+46771921921']);

// The school's number as printed on its own site. Taken only when it is the
// one number on the crawled pages, or clearly the main one (at least three
// mentions and three times any other); several equal numbers usually mean
// several branches, and a wrong branch is worse than no number.
export function phoneFromPages(pages: Array<{ url: string; text: string }>): Phone | null {
  const found = new Map<string, Phone & { count: number }>();
  for (const page of pages) {
    for (const match of page.text.replace(/\u00a0|\u202f/g, ' ').matchAll(PHONE)) {
      const digits = match[0].replace(/\D/g, '');
      const national = digits.startsWith('46')
        ? digits.slice(2).replace(/^0/, '')
        : digits.slice(1);
      if (national.length < 7 || national.length > 9 || /^(900|939|944)/.test(national)) continue;
      const e164 = `+46${national}`;
      if (NOT_SCHOOL_PHONES.has(e164)) continue;
      const entry = found.get(e164);
      if (entry) entry.count++;
      else
        found.set(e164, {
          display: match[0].replace(/\s+/g, ' ').trim(),
          e164,
          sourceUrl: page.url,
          count: 1,
        });
    }
  }
  const [top, next] = [...found.values()].sort((a, b) => b.count - a.count);
  if (!top) return null;
  if (next && (top.count < 3 || top.count < next.count * 3)) return null;
  return { display: top.display, e164: top.e164, sourceUrl: top.sourceUrl };
}

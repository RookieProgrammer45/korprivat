export type Inbox = { address: string; sourceUrl: string };

const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const NOT_SCHOOL =
  /noreply|no-reply|donotreply|example\.|wix\.|sentry|wordpress|schema\.org|godaddy|cloudflare|trafikverket|facebook|instagram|google|apple\.com|microsoft/i;

// The school's inbox as printed on its own site. Same rule as the phone
// number: one address, or a clearly dominant one. The address is only used
// as a mailto link; it is never shown as text.
export function emailFromPages(pages: Array<{ url: string; text: string }>): Inbox | null {
  const found = new Map<string, Inbox & { count: number }>();
  for (const page of pages) {
    for (const match of page.text.matchAll(EMAIL)) {
      const address = match[0].toLowerCase();
      if (address.length > 254 || NOT_SCHOOL.test(address)) continue;
      const entry = found.get(address);
      if (entry) entry.count++;
      else found.set(address, { address, sourceUrl: page.url, count: 1 });
    }
  }
  const [top, next] = [...found.values()].sort((a, b) => b.count - a.count);
  if (!top) return null;
  if (next && (top.count < 3 || top.count < next.count * 3)) return null;
  return { address: top.address, sourceUrl: top.sourceUrl };
}

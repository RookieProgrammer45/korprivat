// Re-reads lesson prices for driving schools outside Sweden.
//
//   npx tsx scripts/regional-schools/extract.ts --fetch
//   npx tsx scripts/regional-schools/extract.ts --extract   needs OPENAI_API_KEY
//   npx tsx scripts/regional-schools/extract.ts --write
//
// Same rules as scripts/school-prices/refresh.ts: each school's own website,
// robots.txt honoured, one request per host at a time. OpenAI may only return
// a price that is written on the crawled pages. A package total or a "from"
// price is not a lesson price.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const FILES = [
  'data/nordic-schools/schools.json',
  'data/australia-schools/schools.json',
  'data/uk-schools/schools.json',
];
const CACHE_DIR = path.join(process.cwd(), 'data/regional-schools/.cache');
const USER_AGENT = 'DriveLinkUpPriceBot/1.0 (+https://www.drivelinkup.com/kontakt)';
const PRICE_LINK =
  /pris|price|pricing|cost|fee|hinta|ver[ðd]|leksjon|lektion|lesson|k[øo]retime|timpris|timepris|tariff/i;
const MAX_PAGES = 6;
const MAX_CHARS_PER_PAGE = 12_000;
const MAX_CHARS_TOTAL = 40_000;
const PRICE_CAP: Record<string, readonly [number, number]> = {
  NO: [400, 2500],
  DK: [200, 1500],
  IS: [2000, 30000],
  FI: [20, 200],
  AU: [50, 200],
  GB: [20, 80],
};

type School = {
  id: string;
  country: string;
  name: string;
  website: string | null;
  lessonPrice: number | null;
  lessonMinutes: number | null;
  currency: string;
  sourceUrl: string | null;
  checkedAt?: string;
  websiteStatus?: string;
};
type Dataset = { meta: Record<string, unknown>; schools: School[] };
type CachedPage = { url: string; text: string };
type FetchCache = { fetchedAt: string; ok: boolean; error?: string; pages: CachedPage[] };
type Extraction = {
  lessonAmount: number | null;
  minutes: number | null;
  currency: string | null;
  sourceUrl: string | null;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

export function decideLesson(
  school: Pick<School, 'country' | 'currency'>,
  extraction: Extraction,
  pages: CachedPage[],
): { lessonPrice: number | null; lessonMinutes: number | null } {
  const cap = PRICE_CAP[school.country];
  const amount = extraction.lessonAmount;
  const currency = extraction.currency?.toUpperCase() ?? null;
  const onPage =
    amount != null &&
    cap != null &&
    amount >= cap[0] &&
    amount <= cap[1] &&
    currency === school.currency &&
    pages.some((page) => amountNearCurrency(amount, page.text));
  const minutes =
    extraction.minutes != null && extraction.minutes >= 20 && extraction.minutes <= 120
      ? extraction.minutes
      : null;
  return { lessonPrice: onPage ? amount : null, lessonMinutes: onPage ? minutes : null };
}

function amountNearCurrency(amount: number, text: string): boolean {
  const normalized = text.replace(/\u00a0|\u202f/g, ' ');
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '[ .,]?');
  const money =
    '(?:£|€|\\$|\\bkr\\b|kroner|kronur|kronor|\\bnok\\b|\\bdkk\\b|\\bisk\\b|\\baud\\b|\\bgbp\\b|pounds?)';
  const pattern = new RegExp(
    `${money}[^\\d]{0,24}${grouped}(?!\\d)|${grouped}(?!\\d)[^\\d]{0,24}${money}`,
    'i',
  );
  return pattern.test(normalized);
}

async function main() {
  const datasets = FILES.flatMap((file) => {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) return [];
    return [{ file, full, dataset: JSON.parse(readFileSync(full, 'utf8')) as Dataset }];
  });
  const ids = option('ids')?.split(',');
  const limit = Number(option('limit') ?? Number.POSITIVE_INFINITY);
  const targets = datasets
    .flatMap((entry) => entry.dataset.schools.map((school) => ({ ...entry, school })))
    .filter((entry) => entry.school.website && (!ids || ids.includes(entry.school.id)))
    .slice(0, limit);
  mkdirSync(CACHE_DIR, { recursive: true });
  const concurrency = Number(option('concurrency') ?? 8);

  if (flag('fetch')) {
    await pool(targets, concurrency, async (entry, index) => {
      const cache = await crawlSchool(entry.school);
      writeFileSync(cachePath(entry.school, 'fetch'), JSON.stringify(cache));
      log(
        index,
        targets.length,
        entry.school.id,
        cache.ok ? `${cache.pages.length} pages` : cache.error,
      );
    });
  }

  if (flag('extract')) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in this shell.');
    const client = new OpenAI();
    const model = option('model') ?? 'gpt-4.1-mini';
    await pool(targets, Math.min(concurrency, 6), async (entry, index) => {
      const fetched = readJson<FetchCache>(cachePath(entry.school, 'fetch'));
      if (!fetched?.ok || fetched.pages.length === 0) return;
      try {
        const extraction = await extract(client, model, entry.school, fetched);
        writeFileSync(cachePath(entry.school, 'extract'), JSON.stringify(extraction));
        const decided = decideLesson(entry.school, extraction, fetched.pages);
        log(
          index,
          targets.length,
          entry.school.id,
          decided.lessonPrice == null ? 'no lesson price' : String(decided.lessonPrice),
        );
      } catch (error) {
        log(index, targets.length, entry.school.id, `extract failed: ${String(error)}`);
      }
    });
  }

  if (flag('write')) {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of datasets) {
      let priced = 0;
      for (const school of entry.dataset.schools) {
        if (!school.website) continue;
        const fetched = readJson<FetchCache>(cachePath(school, 'fetch'));
        if (!fetched) continue;
        school.checkedAt = today;
        if (!fetched.ok) {
          school.websiteStatus = 'SITE_UNREACHABLE';
          continue;
        }
        const extraction = readJson<Extraction>(cachePath(school, 'extract'));
        if (!extraction) continue;
        const decided = decideLesson(school, extraction, fetched.pages);
        school.lessonPrice = decided.lessonPrice;
        school.lessonMinutes = decided.lessonMinutes;
        school.websiteStatus = 'OK';
        if (
          extraction.sourceUrl &&
          fetched.pages.some((page) => page.url === extraction.sourceUrl)
        ) {
          school.sourceUrl = extraction.sourceUrl;
        }
        if (decided.lessonPrice != null) priced += 1;
      }
      entry.dataset.meta.collectedAt = today;
      entry.dataset.meta.priceSource =
        "Each school's own website; a single lesson price extracted with OpenAI and kept only when that amount is printed next to the currency.";
      entry.dataset.meta.withLessonPrice = priced;
      writeFileSync(entry.full, `${JSON.stringify(entry.dataset, null, 2)}\n`);
      console.log('wrote', entry.file, priced);
    }
  }
}

async function crawlSchool(school: School): Promise<FetchCache> {
  const fetchedAt = new Date().toISOString();
  const home = normalizeUrl(school.website);
  if (!home) return { fetchedAt, ok: false, error: 'bad url', pages: [] };
  try {
    const disallow = await robotsDisallow(home);
    const homeHtml = await getHtml(home, disallow);
    if (homeHtml == null) return { fetchedAt, ok: false, error: 'blocked', pages: [] };
    const links = extractLinks(homeHtml, home);
    const candidates = [
      ...(school.sourceUrl ? [school.sourceUrl] : []),
      ...links.filter(
        (link) => sameHost(link.url, home) && PRICE_LINK.test(`${link.url} ${link.label}`),
      ),
    ];
    const pages: CachedPage[] = [{ url: home, text: htmlToText(homeHtml) }];
    for (const candidate of candidates) {
      if (pages.length >= MAX_PAGES) break;
      const url = normalizeUrl(candidate);
      if (!url || pages.some((page) => page.url === url) || !sameHost(url, home)) continue;
      const html = await getHtml(url, disallow);
      if (html) pages.push({ url, text: htmlToText(html) });
    }
    return { fetchedAt, ok: true, pages };
  } catch (error) {
    return { fetchedAt, ok: false, error: String(error), pages: [] };
  }
}

async function getHtml(url: string, disallow: string[]): Promise<string | null> {
  const { pathname } = new URL(url);
  if (disallow.some((rule) => rule && pathname.startsWith(rule))) return null;
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  if (!(response.headers.get('content-type') ?? '').includes('html')) return null;
  return (await response.text()).slice(0, 2_000_000);
}

async function robotsDisallow(home: string): Promise<string[]> {
  try {
    const response = await fetch(new URL('/robots.txt', home), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    const rules: string[] = [];
    let applies = false;
    for (const raw of (await response.text()).split('\n')) {
      const line = raw.split('#')[0]?.trim() ?? '';
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (/^user-agent$/i.test(key ?? '')) applies = value === '*' || /drivelinkup/i.test(value);
      else if (applies && /^disallow$/i.test(key ?? '')) rules.push(value);
    }
    return rules;
  } catch {
    return [];
  }
}

function extractLinks(html: string, base: string): Array<{ url: string; label: string }> {
  const links: Array<{ url: string; label: string }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1] ?? '', base);
      if (!/^https?:$/.test(url.protocol)) continue;
      url.hash = '';
      links.push({ url: url.toString(), label: htmlToText(match[2] ?? '') });
    } catch {
      // Skip malformed hrefs.
    }
  }
  return links;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, MAX_CHARS_PER_PAGE);
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lessonAmount', 'minutes', 'currency', 'sourceUrl'],
  properties: {
    lessonAmount: { type: ['integer', 'null'] },
    minutes: { type: ['integer', 'null'] },
    currency: {
      anyOf: [
        { type: 'string', enum: ['NOK', 'DKK', 'ISK', 'EUR', 'AUD', 'GBP'] },
        { type: 'null' },
      ],
    },
    sourceUrl: { type: ['string', 'null'] },
  },
} as const;

const INSTRUCTIONS = `You read a driving school's own web pages and extract the published price of ONE standard car driving lesson.
Rules:
- Only use a price written on the pages. Never estimate, average, or divide a package into a lesson price. Use null when a single lesson price is not stated.
- lessonAmount is an integer in the currency printed beside it. Ignore "from" / "fra" / "från" prices, block discounts, and package totals.
- When the page states both a manual and an automatic lesson, use the manual or standard lesson the page leads with.
- minutes is the length of that lesson. currency is NOK, DKK, ISK, EUR, AUD, or GBP.
- sourceUrl must be one of the given URLs, or null when no lesson price is stated.`;

async function extract(
  client: OpenAI,
  model: string,
  school: School,
  fetched: FetchCache,
): Promise<Extraction> {
  let budget = MAX_CHARS_TOTAL;
  const pages = fetched.pages
    .map((page) => {
      const text = page.text.slice(0, Math.max(0, budget));
      budget -= text.length;
      return `URL: ${page.url}\n${text}`;
    })
    .filter((page) => page.length > 10)
    .join('\n\n-----\n\n');
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'lesson_price', strict: true, schema: EXTRACTION_SCHEMA },
    },
    messages: [
      { role: 'system', content: INSTRUCTIONS },
      {
        role: 'user',
        content: `School: ${school.name}\nCountry currency: ${school.currency}\n\n${pages}`,
      },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('empty response');
  const extraction = JSON.parse(content) as Extraction;
  const urls = new Set(fetched.pages.map((page) => page.url));
  if (extraction.sourceUrl && !urls.has(extraction.sourceUrl)) extraction.sourceUrl = null;
  return extraction;
}

function cachePath(school: School, stage: 'fetch' | 'extract'): string {
  return path.join(CACHE_DIR, `${school.country}-${school.id}.${stage}.json`);
}

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function sameHost(url: string, home: string): boolean {
  try {
    return new URL(url).host.replace(/^www\./, '') === new URL(home).host.replace(/^www\./, '');
  } catch {
    return false;
  }
}

function log(index: number, total: number, id: string, message: string | undefined) {
  console.log(`${index + 1}/${total} ${id} ${message ?? ''}`);
}

async function pool<T extends { school: School }>(
  items: T[],
  size: number,
  run: (item: T, index: number) => Promise<void>,
) {
  const hosts = new Set<string>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      const host = hostOf(item.school.website);
      while (host && hosts.has(host)) await new Promise((resolve) => setTimeout(resolve, 200));
      if (host) hosts.add(host);
      try {
        await run(item, index);
      } finally {
        if (host) hosts.delete(host);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, size) }, worker));
}

function hostOf(website: string | null): string | null {
  try {
    return website ? new URL(website).host : null;
  } catch {
    return null;
  }
}

if (process.argv[1]?.endsWith('extract.ts')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

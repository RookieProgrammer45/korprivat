// Re-reads lesson prices for driving schools outside Sweden.
//
//   npx tsx scripts/regional-schools/extract.ts --fetch
//   npx tsx scripts/regional-schools/extract.ts --extract   needs OPENAI_API_KEY
//   npx tsx scripts/regional-schools/extract.ts --write
//   npx tsx scripts/regional-schools/extract.ts --only europe-schools --country IE --fetch --extract --write
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
  'data/europe-schools/schools.json',
];
const CACHE_DIR = path.join(process.cwd(), 'data/regional-schools/.cache');
const USER_AGENT = 'DriveLinkUpPriceBot/1.0 (+https://www.drivelinkup.com/contact)';
const PRICE_LINK =
  /pris|price|pricing|cost|fee|hinta|ver[ðd]|leksjon|lektion|lesson|k[øo]retime|timpris|timepris|tariff|preis|precio|prix|prezzo|cena|cennik|prijs|pre[cç]o|kosten/i;
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
  ES: [15, 150],
  FR: [15, 150],
  DE: [15, 150],
  IT: [15, 150],
  AT: [15, 150],
  BE: [15, 150],
  NL: [15, 150],
  PT: [15, 150],
  IE: [15, 150],
  LU: [15, 150],
  SK: [15, 150],
  HR: [15, 150],
  SI: [15, 150],
  GR: [15, 150],
  CY: [15, 150],
  MT: [15, 150],
  EE: [15, 150],
  LV: [15, 150],
  LT: [15, 150],
  PL: [40, 250],
  CH: [40, 200],
  CZ: [300, 1500],
  HU: [4000, 25000],
  RO: [40, 250],
  BG: [20, 120],
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
  const cited = pages.find((page) => page.url === extraction.sourceUrl);
  const onPage =
    amount != null &&
    cap != null &&
    amount >= cap[0] &&
    amount <= cap[1] &&
    currency === school.currency &&
    cited != null &&
    firmLessonPrice(amount, school.currency, cited.text);
  const minutes =
    extraction.minutes != null && extraction.minutes >= 20 && extraction.minutes <= 120
      ? extraction.minutes
      : null;
  return { lessonPrice: onPage ? amount : null, lessonMinutes: onPage ? minutes : null };
}

const FROM_PRICE =
  /(?:\bfrom\b|\bstarting(?:\s+at)?\b|\bfra\b|\bfrån\b|\bab\b|\bdès\b|\bdesde\b|à partir|a partir|\bvanaf\b|\bod\b|a partire|\bde la\b|\bот\b|t[oó]l\b)/i;
const PACKAGE_PRICE =
  /\b(?:forfait|paket|paquete|pacchetto|pakiet|bal[ií][cč]ek|csomag|pachet|package|bundle)\b|\b(?:[2-9]|\d{2,})\s*(?:lessons?|leksjoner|lektioner|lektion|le[cç]ons?|stunden|fahrstunden|uur|horas|heures|ore|órák|lekcji|lekcje|clases|classes)\b/i;
const PER_LESSON =
  /per\s+(?:lesson|hour|leksjon|lektion)|\/\s*h(?:our|r)?\b|pro\s+(?:stunde|fahrstunde)|par\s+(?:le[cç]on|heure)|por\s+(?:hora|clase)|à l['’]heure|all['’]ora|per\s+uur|za\s+(?:godzin|lekcj|jazd)/i;

function currencyPattern(currency: string): string {
  switch (currency) {
    case 'EUR':
      return '€|\\beur\\b';
    case 'GBP':
      return '£|\\bgbp\\b|pounds?';
    case 'AUD':
      return '\\$|\\baud\\b';
    case 'PLN':
      return 'z[łl]|\\bpln\\b';
    case 'CHF':
      return '\\bchf\\b|francs?';
    case 'CZK':
      return 'k[čc]|\\bczk\\b';
    case 'HUF':
      return '\\bft\\b|\\bhuf\\b';
    case 'RON':
      return '\\blei\\b|\\bron\\b';
    case 'BGN':
      return 'лв|\\bbgn\\b';
    case 'DKK':
      return '\\bkr\\b|kroner|\\bdkk\\b';
    case 'ISK':
      return '\\bkr\\b|kronur|\\bisk\\b';
    default:
      return '\\bkr\\b|kroner|\\bnok\\b';
  }
}

function firmLessonPrice(amount: number, currency: string, text: string): boolean {
  const normalized = text.replace(/\u00a0|\u202f/g, ' ');
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '[ .,]?');
  const amountPattern = `${grouped}(?!\\d)(?:[.,]0+)?(?![.,]\\d)`;
  const money = `(?:${currencyPattern(currency)})`;
  const pattern = new RegExp(
    `${money}[^\\d]{0,24}${amountPattern}|${amountPattern}[^\\d]{0,24}${money}`,
    'gi',
  );
  for (const match of normalized.matchAll(pattern)) {
    const start = match.index ?? 0;
    const before = normalized.slice(Math.max(0, start - 40), start);
    const around = normalized.slice(Math.max(0, start - 80), start + match[0].length + 40);
    if (FROM_PRICE.test(before)) continue;
    if (PACKAGE_PRICE.test(around) && !PER_LESSON.test(around)) continue;
    return true;
  }
  return false;
}

async function main() {
  const only = option('only');
  const datasets = FILES.flatMap((file) => {
    if (only && !file.includes(only)) return [];
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) return [];
    return [{ file, full, dataset: JSON.parse(readFileSync(full, 'utf8')) as Dataset }];
  });
  const ids = option('ids')?.split(',');
  const country = option('country')?.toUpperCase();
  const limit = Number(option('limit') ?? Number.POSITIVE_INFINITY);
  const targets = datasets
    .flatMap((entry) => entry.dataset.schools.map((school) => ({ ...entry, school })))
    .filter((entry) => entry.school.website && (!ids || ids.includes(entry.school.id)))
    .filter((entry) => !country || entry.school.country === country)
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

  const extractErrors = new Map<string, string>();
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
        const message = publicError(error);
        extractErrors.set(entry.school.id, message);
        log(index, targets.length, entry.school.id, `extract failed: ${message}`);
      }
    });
  }

  if (flag('write')) {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of datasets) {
      const notes: PriceRunNote[] = [];
      for (const school of entry.dataset.schools) {
        if (!school.website) continue;
        const fetched = readJson<FetchCache>(cachePath(school, 'fetch'));
        const inCountry = !country || school.country === country;
        if (!fetched) {
          if (inCountry)
            notes.push(note(school, 'missing', 0, extractErrors.get(school.id) ?? null));
          continue;
        }
        school.checkedAt = today;
        if (!fetched.ok) {
          school.websiteStatus = 'SITE_UNREACHABLE';
          if (inCountry) notes.push(note(school, 'unreachable', 0, fetched.error ?? null));
          continue;
        }
        const extraction = readJson<Extraction>(cachePath(school, 'extract'));
        if (!extraction) {
          if (inCountry) {
            notes.push(
              note(school, 'ok', fetched.pages.length, extractErrors.get(school.id) ?? null),
            );
          }
          continue;
        }
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
        if (inCountry) notes.push(note(school, 'ok', fetched.pages.length, null));
      }
      const priced = entry.dataset.schools.filter((school) => school.lessonPrice != null).length;
      entry.dataset.meta.collectedAt = today;
      entry.dataset.meta.priceSource =
        "Each school's own website. OpenAI may only return a price printed on the cited page, and the price is kept only when that page states it for one lesson, next to the school's currency. A from-price, a package total, or a rounded decimal is left empty.";
      entry.dataset.meta.withLessonPrice = priced;
      writeFileSync(entry.full, `${JSON.stringify(entry.dataset, null, 2)}\n`);
      console.log('wrote', entry.file, priced);
      if (country && entry.file.includes('europe-schools')) writePriceRun(country, notes);
    }
  }
}

type PriceRunNote = {
  id: string;
  name: string;
  fetch: 'missing' | 'unreachable' | 'ok';
  pages: number;
  error: string | null;
  lessonPrice: number | null;
};

function note(
  school: School,
  fetch: PriceRunNote['fetch'],
  pages: number,
  error: string | null,
): PriceRunNote {
  return {
    id: school.id,
    name: school.name,
    fetch,
    pages,
    error,
    lessonPrice: school.lessonPrice,
  };
}

function writePriceRun(country: string, notes: PriceRunNote[]) {
  const directory = path.join(process.cwd(), 'data/europe-schools/price-runs');
  mkdirSync(directory, { recursive: true });
  const priced = notes.filter((item) => item.lessonPrice != null).length;
  writeFileSync(
    path.join(directory, `${country}.json`),
    `${JSON.stringify({ country, priced, schools: notes }, null, 2)}\n`,
  );
  console.log('price run', country, 'priced', priced, 'noted', notes.length);
}

function publicError(error: unknown): string {
  const message = String(error);
  if (/incorrect api key|\b401\b/i.test(message)) return 'OpenAI rejected the API key (401).';
  return message.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-redacted').slice(0, 500);
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
      ...links
        .filter((link) => sameHost(link.url, home) && PRICE_LINK.test(`${link.url} ${link.label}`))
        .map((link) => link.url),
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
        {
          type: 'string',
          enum: [
            'NOK',
            'DKK',
            'ISK',
            'EUR',
            'AUD',
            'GBP',
            'PLN',
            'CZK',
            'HUF',
            'RON',
            'BGN',
            'CHF',
          ],
        },
        { type: 'null' },
      ],
    },
    sourceUrl: { type: ['string', 'null'] },
  },
} as const;

const INSTRUCTIONS = `You read a driving school's own web pages and extract the published price of ONE standard car driving lesson.
Rules:
- Only use a price written on the pages. Never estimate, average, round, or divide a package into a lesson price. Use null when a single lesson price is not stated.
- lessonAmount is the integer printed beside the currency. Ignore "from", "fra", "från", "ab", "à partir", "desde", "vanaf", and "od" prices. Ignore a package or block total. 45,90 is not 45 or 46.
- When the page states both a manual and an automatic lesson, use the manual or standard lesson the page leads with.
- minutes is the length of that lesson. currency is NOK, DKK, ISK, EUR, AUD, GBP, PLN, CZK, HUF, RON, BGN, or CHF.
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

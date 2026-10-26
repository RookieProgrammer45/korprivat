// Re-collects published prices for data/school-prices/school-prices.json.
//
//   npx tsx scripts/school-prices/refresh.ts --fetch     crawl school websites into .cache/
//   npx tsx scripts/school-prices/refresh.ts --extract   extract prices from .cache/ (needs OPENAI_API_KEY)
//   npx tsx scripts/school-prices/refresh.ts --write     rebuild school-prices.json + .csv from .cache/
//   Options: --limit N, --ids id1,id2, --concurrency N, --model NAME
//
// Only each school's own website is crawled, robots.txt is honoured, and one
// request per host is in flight at a time. Social profiles are recorded as
// links only; Facebook/Instagram terms forbid automated collection.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const DATA_DIR = path.join(process.cwd(), 'data/school-prices');
const CACHE_DIR = path.join(DATA_DIR, '.cache');
const JSON_PATH = path.join(DATA_DIR, 'school-prices.json');
const CSV_PATH = path.join(DATA_DIR, 'school-prices.csv');
const USER_AGENT = 'DriveLinkUpPriceBot/1.0 (+https://www.drivelinkup.com/kontakt)';
const PRICE_LINK = /pris|priser|prislista|paket|risk|halk|kurs|intensiv|shop|butik|erbjud|price/i;
const SOCIAL_LINK = /^https?:\/\/(www\.)?(facebook|instagram|tiktok)\.com\/[^\s"'?#]+/i;
const SOCIAL_POST = /\/(p|reel|reels|posts|photo|sharer|share|watch|video)\b|sharer\.php/i;
const MAX_PAGES = 6;
const MAX_CHARS_PER_PAGE = 12_000;
const MAX_CHARS_TOTAL = 40_000;

type Course = { name: string; contents: string; priceSek: number | null };
type LessonPackage = { name: string; lessons: number | null; contents: string; priceSek: number };
type School = {
  id: string;
  name: string;
  listingIds: string[];
  counties: string[];
  cities: string[];
  registerNames: string[];
  website: string | null;
  lesson: {
    priceSek: number | null;
    minutes: number | null;
    pricePerMinuteSek: number | null;
    note: string | null;
  };
  testLessonSek: number | null;
  risk1Sek: number | null;
  risk2Sek: number | null;
  packages?: LessonPackage[];
  intensive: {
    offered: 'PRICE_LISTED' | 'ON_REQUEST' | 'NOT_MENTIONED' | 'UNKNOWN';
    cheapestPriceSek: number | null;
    courses: Course[];
  };
  social?: string[];
  status: string;
  sourceUrl: string | null;
  checkedAt?: string;
};
type Dataset = { meta: Record<string, unknown> & { collectedAt: string }; schools: School[] };

type CachedPage = { url: string; text: string };
type FetchCache = {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  pages: CachedPage[];
  social: string[];
};
type Extraction = {
  lesson: { priceSek: number | null; minutes: number | null; note: string | null };
  testLessonSek: number | null;
  risk1Sek: number | null;
  risk2Sek: number | null;
  packages: LessonPackage[];
  intensive: { offered: School['intensive']['offered']; courses: Course[] };
  sourceUrl: string | null;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const dataset = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Dataset;
  const ids = option('ids')?.split(',');
  const limit = Number(option('limit') ?? Number.POSITIVE_INFINITY);
  const concurrency = Number(option('concurrency') ?? 8);
  const targets = dataset.schools
    .filter((school) => school.website && (!ids || ids.includes(school.id)))
    .slice(0, limit);
  mkdirSync(CACHE_DIR, { recursive: true });

  if (flag('fetch')) {
    await pool(targets, concurrency, async (school, index) => {
      const cache = await crawlSchool(school);
      writeFileSync(cachePath(school.id, 'fetch'), JSON.stringify(cache));
      log(index, targets.length, school.id, cache.ok ? `${cache.pages.length} pages` : cache.error);
    });
  }

  if (flag('extract')) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in this shell.');
    const client = new OpenAI();
    const model = option('model') ?? 'gpt-4.1-mini';
    await pool(targets, Math.min(concurrency, 6), async (school, index) => {
      const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch'));
      if (!fetched?.ok || fetched.pages.length === 0) return;
      try {
        const extraction = sanitize(await extract(client, model, school, fetched));
        writeFileSync(cachePath(school.id, 'extract'), JSON.stringify(extraction));
        log(index, targets.length, school.id, summary(extraction));
      } catch (error) {
        log(index, targets.length, school.id, `extract failed: ${String(error)}`);
      }
    });
  }

  if (flag('write')) {
    const today = new Date().toISOString().slice(0, 10);
    for (const school of dataset.schools) merge(school, today);
    dataset.meta.collectedAt = today;
    dataset.meta.priceSource =
      "Each school's own website or its web shop; extracted automatically, spot-checked manually";
    dataset.meta.counts = {
      ...(dataset.meta.counts as Record<string, number>),
      withLessonPrice: dataset.schools.filter((s) => s.lesson.priceSek != null).length,
      withRisk1Price: dataset.schools.filter((s) => s.risk1Sek != null).length,
      withRisk2Price: dataset.schools.filter((s) => s.risk2Sek != null).length,
      withPackagePrice: dataset.schools.filter((s) => (s.packages?.length ?? 0) > 0).length,
      withIntensivePrice: dataset.schools.filter((s) => s.intensive.cheapestPriceSek != null)
        .length,
    };
    writeFileSync(JSON_PATH, `${JSON.stringify(dataset, null, 2)}\n`);
    writeFileSync(CSV_PATH, toCsv(dataset.schools));
    console.log('wrote', JSON_PATH, dataset.meta.counts);
  }
}

// --- crawl -------------------------------------------------------------------

async function crawlSchool(school: School): Promise<FetchCache> {
  const fetchedAt = new Date().toISOString();
  const home = normalizeUrl(school.website);
  if (!home) return { fetchedAt, ok: false, error: 'bad url', pages: [], social: [] };
  try {
    const disallow = await robotsDisallow(home);
    const homeHtml = await getHtml(home, disallow);
    if (homeHtml == null) return { fetchedAt, ok: false, error: 'blocked', pages: [], social: [] };

    const links = extractLinks(homeHtml, home);
    const social = [
      ...new Set(
        links
          .map((link) => link.url)
          .filter((url) => SOCIAL_LINK.test(url) && !SOCIAL_POST.test(url)),
      ),
    ].slice(0, 5);
    const candidates = [
      ...(school.sourceUrl ? [school.sourceUrl] : []),
      ...links
        .filter((link) => sameHost(link.url, home) && looksLikePricePage(link))
        .map((link) => link.url),
    ];
    const pages: CachedPage[] = [{ url: home, text: htmlToText(homeHtml) }];
    for (const url of [...new Set(candidates.map((candidate) => normalizeUrl(candidate) ?? ''))]) {
      if (pages.length >= MAX_PAGES) break;
      if (!url || pages.some((page) => page.url === url) || !sameHost(url, home)) continue;
      const html = await getHtml(url, disallow);
      if (html) pages.push({ url, text: htmlToText(html) });
    }
    return { fetchedAt, ok: true, pages, social };
  } catch (error) {
    return { fetchedAt, ok: false, error: String(error), pages: [], social: [] };
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
    } catch {}
  }
  return links;
}

function looksLikePricePage(link: { url: string; label: string }): boolean {
  let decoded = link.url;
  try {
    decoded = decodeURIComponent(link.url);
  } catch {}
  return PRICE_LINK.test(decoded) || PRICE_LINK.test(link.label);
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, MAX_CHARS_PER_PAGE);
}

// --- extract -----------------------------------------------------------------

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'lesson',
    'testLessonSek',
    'risk1Sek',
    'risk2Sek',
    'packages',
    'intensive',
    'sourceUrl',
  ],
  properties: {
    lesson: {
      type: 'object',
      additionalProperties: false,
      required: ['priceSek', 'minutes', 'note'],
      properties: {
        priceSek: { type: ['integer', 'null'] },
        minutes: { type: ['integer', 'null'] },
        note: { type: ['string', 'null'] },
      },
    },
    testLessonSek: { type: ['integer', 'null'] },
    risk1Sek: { type: ['integer', 'null'] },
    risk2Sek: { type: ['integer', 'null'] },
    packages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'lessons', 'contents', 'priceSek'],
        properties: {
          name: { type: 'string' },
          lessons: { type: ['integer', 'null'] },
          contents: { type: 'string' },
          priceSek: { type: 'integer' },
        },
      },
    },
    intensive: {
      type: 'object',
      additionalProperties: false,
      required: ['offered', 'courses'],
      properties: {
        offered: {
          type: 'string',
          enum: ['PRICE_LISTED', 'ON_REQUEST', 'NOT_MENTIONED', 'UNKNOWN'],
        },
        courses: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'contents', 'priceSek'],
            properties: {
              name: { type: 'string' },
              contents: { type: 'string' },
              priceSek: { type: ['integer', 'null'] },
            },
          },
        },
      },
    },
    sourceUrl: { type: ['string', 'null'] },
  },
} as const;

const INSTRUCTIONS = `You read Swedish driving-school web pages and extract published prices for licence category B (car), in SEK including VAT.
Rules:
- Only use prices written on the pages. Never estimate or infer. Use null when a price is not stated.
- lesson: the ordinary price of ONE standard weekday B driving lesson and its length in minutes. Put campaign, weekend or manual/automatic differences in note (Swedish, short).
- risk1Sek: Riskettan (Risk 1, alcohol/drugs/fatigue). risk2Sek: Risktvåan (Risk 2, halkbana/skid pan). Category B only, not motorcycle.
- packages: bundles of several driving lessons and/or theory/risk courses sold for one price (e.g. "Paket 10 lektioner"). lessons = number of driving lessons included, or null. Exclude intensive courses here.
- intensive: intensive courses (intensivkurs/intensivutbildning). offered = PRICE_LISTED, ON_REQUEST, NOT_MENTIONED or UNKNOWN.
- sourceUrl: the page URL where the lesson price (or, if none, the main price list) appears; must be one of the given URLs.`;

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
      json_schema: { name: 'school_prices', strict: true, schema: EXTRACTION_SCHEMA },
    },
    messages: [
      { role: 'system', content: INSTRUCTIONS },
      { role: 'user', content: `School: ${school.name}\n\n${pages}` },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('empty response');
  const extraction = JSON.parse(content) as Extraction;
  const urls = new Set(fetched.pages.map((page) => page.url));
  if (extraction.sourceUrl && !urls.has(extraction.sourceUrl)) extraction.sourceUrl = null;
  return extraction;
}

// Plausibility bounds drop extraction slips (package totals read as a lesson
// price, öre, phone numbers).
function sanitize(extraction: Extraction): Extraction {
  const within = (value: number | null, min: number, max: number) =>
    value != null && value >= min && value <= max ? value : null;
  return {
    ...extraction,
    lesson: {
      priceSek: within(extraction.lesson.priceSek, 200, 2_500),
      minutes: within(extraction.lesson.minutes, 20, 120),
      note: extraction.lesson.note,
    },
    testLessonSek: within(extraction.testLessonSek, 100, 2_500),
    risk1Sek: within(extraction.risk1Sek, 300, 2_500),
    risk2Sek: within(extraction.risk2Sek, 1_000, 6_000),
    packages: extraction.packages
      .filter((pack) => within(pack.priceSek, 1_000, 80_000) != null)
      .slice(0, 8),
    intensive: {
      offered: extraction.intensive.offered,
      courses: extraction.intensive.courses
        .map((course) => ({ ...course, priceSek: within(course.priceSek, 2_000, 100_000) }))
        .slice(0, 6),
    },
  };
}

// --- write -------------------------------------------------------------------

function merge(school: School, today: string) {
  const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch'));
  const extraction = readJson<Extraction>(cachePath(school.id, 'extract'));
  if (fetched?.social.length) school.social = fetched.social;
  if (!fetched) return;
  school.checkedAt = fetched.fetchedAt.slice(0, 10);
  if (!fetched.ok) {
    if (school.status === 'OK') school.status = 'SITE_UNREACHABLE';
    return;
  }
  if (!extraction) return;
  const { lesson } = extraction;
  school.lesson = {
    priceSek: lesson.priceSek,
    minutes: lesson.minutes,
    pricePerMinuteSek:
      lesson.priceSek && lesson.minutes
        ? Math.round((lesson.priceSek / lesson.minutes) * 10) / 10
        : null,
    note: lesson.note,
  };
  school.testLessonSek = extraction.testLessonSek;
  school.risk1Sek = extraction.risk1Sek;
  school.risk2Sek = extraction.risk2Sek;
  school.packages = extraction.packages;
  const priced = extraction.intensive.courses.flatMap((course) =>
    course.priceSek == null ? [] : [course.priceSek],
  );
  school.intensive = {
    offered: extraction.intensive.offered,
    cheapestPriceSek: priced.length > 0 ? Math.min(...priced) : null,
    courses: extraction.intensive.courses,
  };
  const anyPrice =
    lesson.priceSek != null ||
    extraction.risk1Sek != null ||
    extraction.risk2Sek != null ||
    extraction.packages.length > 0 ||
    priced.length > 0;
  school.status = anyPrice ? 'OK' : 'PRICE_NOT_PUBLISHED';
  school.sourceUrl = extraction.sourceUrl ?? school.sourceUrl;
  school.checkedAt = today;
}

function toCsv(schools: School[]): string {
  const header = [
    'Län',
    'Ort(er)',
    'Trafikskola',
    'Körlektion (kr)',
    'Längd (min)',
    'Kr/min',
    'Kommentar lektion',
    'Testlektion (kr)',
    'Riskettan (kr)',
    'Risktvåan (kr)',
    'Paket (namn – lektioner – pris)',
    'Intensivkurs?',
    'Billigaste intensivkurs (kr)',
    'Intensivkurser (innehåll – pris)',
    'Status',
    'Källa (skolans webbplats)',
    'Sociala medier',
    'Kontrollerad',
  ];
  const cell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const offered: Record<School['intensive']['offered'], string> = {
    PRICE_LISTED: 'Ja',
    ON_REQUEST: 'Ja, pris på förfrågan',
    NOT_MENTIONED: 'Nämns ej',
    UNKNOWN: '–',
  };
  const rows = schools.map((school) =>
    [
      school.counties.join(', '),
      school.cities.join(', '),
      school.name,
      school.lesson.priceSek,
      school.lesson.minutes,
      school.lesson.pricePerMinuteSek,
      school.lesson.note,
      school.testLessonSek,
      school.risk1Sek,
      school.risk2Sek,
      (school.packages ?? [])
        .map((pack) => `${pack.name} – ${pack.lessons ?? '?'} – ${pack.priceSek}`)
        .join(' | '),
      offered[school.intensive.offered],
      school.intensive.cheapestPriceSek,
      school.intensive.courses
        .map(
          (course) =>
            `${course.name}: ${course.contents} – ${course.priceSek ?? 'pris på förfrågan'}`,
        )
        .join(' | '),
      school.status,
      school.sourceUrl,
      (school.social ?? []).join(' '),
      school.checkedAt,
    ]
      .map(cell)
      .join(';'),
  );
  return `\uFEFF${[header.join(';'), ...rows].join('\n')}\n`;
}

// --- helpers -----------------------------------------------------------------

async function pool<T>(items: T[], size: number, run: (item: T, index: number) => Promise<void>) {
  const hosts = new Set<string>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      const host = hostOf((item as { website?: string | null }).website);
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

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).toString();
  } catch {
    return null;
  }
}

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(normalizeUrl(url) ?? '').hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

function sameHost(url: string, home: string): boolean {
  const site = (value: string) => hostOf(value)?.split('.').slice(-2).join('.') ?? null;
  return site(url) != null && site(url) === site(home);
}

function cachePath(id: string, stage: 'fetch' | 'extract'): string {
  return path.join(CACHE_DIR, `${id}.${stage}.json`);
}

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

function summary(extraction: Extraction): string {
  return `lesson ${extraction.lesson.priceSek ?? '-'} risk1 ${extraction.risk1Sek ?? '-'} risk2 ${
    extraction.risk2Sek ?? '-'
  } packages ${extraction.packages.length}`;
}

function log(index: number, total: number, id: string, message: string | undefined) {
  console.log(`[${index + 1}/${total}] ${id}: ${message ?? ''}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

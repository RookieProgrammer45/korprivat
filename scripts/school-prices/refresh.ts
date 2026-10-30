// Re-collects published prices for data/school-prices/school-prices.json.
//
//   npx tsx scripts/school-prices/refresh.ts --fetch     crawl school websites into .cache/
//   npx tsx scripts/school-prices/refresh.ts --extract   extract prices from .cache/ (needs OPENAI_API_KEY)
//   npx tsx scripts/school-prices/refresh.ts --write     rebuild school-prices.json + .csv from .cache/
//   Options: --limit N, --ids id1,id2, --concurrency N, --model NAME
//   --heavy   run the same stages for heavy vehicles (C1/C1E/C/CE, D1/D1E/D/DE,
//             YKB) into school.heavy; B prices are left untouched
//   --linked  only schools linked to a DriveLinkUp listing
//   --phones  only refresh school.phone from the cached pages (--write also does)
//
// Only each school's own website is crawled, robots.txt is honoured, and one
// request per host is in flight at a time. Social profiles are recorded as
// links only; Facebook/Instagram terms forbid automated collection.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { emailFromPages, type Inbox } from './email';
import { type Phone, phoneFromPages } from './phone';

const DATA_DIR = path.join(process.cwd(), 'data/school-prices');
const CACHE_DIR = path.join(DATA_DIR, '.cache');
const JSON_PATH = path.join(DATA_DIR, 'school-prices.json');
const CSV_PATH = path.join(DATA_DIR, 'school-prices.csv');
const USER_AGENT = 'DriveLinkUpPriceBot/1.0 (+https://www.drivelinkup.com/contact)';
const PRICE_LINK = /pris|priser|prislista|paket|risk|halk|kurs|intensiv|shop|butik|erbjud|price/i;
const HEAVY_LINK =
  /lastbil|buss|tung|yrkesf[öo]rar|ykb|heavy|truck|\bbus\b|[cd]1?e?-?(k[öo]rkort|beh[öo]righet|utbildning)|\/(c|ce|c1|c1e|d|de|d1|d1e)(\/|-|$)/i;
const HEAVY_SIGNAL =
  /lastbil|buss|tung trafik|ykb|yrkesf[öo]rar|\b(C1?E?|D1?E?)[- ]?(k[öo]rkort|beh[öo]righet|utbildning)|beh[öo]righet (C1?E?|D1?E?)\b/i;
const HEAVY_CATEGORIES = ['C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'] as const;
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
  heavy?: Heavy | null;
  phone?: Phone | null;
  inbox?: Inbox | null;
};
type HeavyCategory = (typeof HEAVY_CATEGORIES)[number];
type HeavyPrice = {
  category: HeavyCategory | 'YKB';
  kind: 'LESSON' | 'COURSE';
  name: string;
  minutes: number | null;
  hours: number | null;
  priceSek: number;
};
type HeavyExtraction = {
  categories: HeavyCategory[];
  ykb: boolean;
  prices: HeavyPrice[];
  sourceUrl: string | null;
};
type Heavy = HeavyExtraction & { checkedAt: string };
type Dataset = { meta: Record<string, unknown> & { collectedAt: string }; schools: School[] };

type CachedPage = { url: string; text: string };
type FetchCache = {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  pages: CachedPage[];
  social: string[];
  // --heavy only: whether any page mentions heavy-vehicle training at all.
  heavySignal?: boolean;
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
  const heavy = flag('heavy');
  const targets = dataset.schools
    .filter(
      (school) =>
        school.website &&
        (!ids || ids.includes(school.id)) &&
        (!flag('linked') || school.listingIds.length > 0),
    )
    .slice(0, limit);
  mkdirSync(CACHE_DIR, { recursive: true });

  if (flag('fetch')) {
    await pool(targets, concurrency, async (school, index) => {
      const cache = await crawlSchool(school, heavy);
      writeFileSync(cachePath(school.id, 'fetch', heavy), JSON.stringify(cache));
      log(
        index,
        targets.length,
        school.id,
        cache.ok
          ? `${cache.pages.length} pages${heavy ? (cache.heavySignal ? ', heavy' : ', no heavy') : ''}`
          : cache.error,
      );
    });
  }

  if (flag('extract')) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in this shell.');
    const client = new OpenAI();
    const model = option('model') ?? 'gpt-4.1-mini';
    await pool(targets, Math.min(concurrency, 6), async (school, index) => {
      const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch', heavy));
      if (!fetched?.ok || fetched.pages.length === 0) return;
      if (heavy && !fetched.heavySignal) return;
      try {
        if (heavy) {
          const extraction = sanitizeHeavy(await extractHeavy(client, model, school, fetched));
          writeFileSync(cachePath(school.id, 'extract', true), JSON.stringify(extraction));
          log(index, targets.length, school.id, heavySummary(extraction));
        } else {
          const extraction = sanitize(await extract(client, model, school, fetched));
          writeFileSync(cachePath(school.id, 'extract'), JSON.stringify(extraction));
          log(index, targets.length, school.id, summary(extraction));
        }
      } catch (error) {
        log(index, targets.length, school.id, `extract failed: ${String(error)}`);
      }
    });
  }

  if (flag('phones')) {
    for (const school of dataset.schools) {
      const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch'));
      if (fetched?.ok) {
        school.phone = phoneFromPages(fetched.pages);
        school.inbox = emailFromPages(fetched.pages);
      }
    }
    dataset.meta.counts = {
      ...(dataset.meta.counts as Record<string, number>),
      withPhone: dataset.schools.filter((s) => s.phone).length,
      withInbox: dataset.schools.filter((s) => s.inbox).length,
    };
    writeFileSync(JSON_PATH, `${JSON.stringify(dataset, null, 2)}\n`);
    writeFileSync(CSV_PATH, toCsv(dataset.schools));
    console.log('wrote', JSON_PATH, dataset.meta.counts);
  } else if (flag('write') && heavy) {
    for (const school of dataset.schools) mergeHeavy(school);
    dataset.meta.counts = {
      ...(dataset.meta.counts as Record<string, number>),
      withHeavyTraining: dataset.schools.filter((s) => s.heavy).length,
      withHeavyPrice: dataset.schools.filter((s) => (s.heavy?.prices.length ?? 0) > 0).length,
    };
    writeFileSync(JSON_PATH, `${JSON.stringify(dataset, null, 2)}\n`);
    writeFileSync(CSV_PATH, toCsv(dataset.schools));
    console.log('wrote', JSON_PATH, dataset.meta.counts);
  } else if (flag('write')) {
    for (const school of dataset.schools) merge(school);
    dataset.meta.collectedAt = dataset.schools
      .map((school) => school.checkedAt ?? '')
      .reduce((latest, day) => (day > latest ? day : latest), dataset.meta.collectedAt);
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

async function crawlSchool(school: School, heavy: boolean): Promise<FetchCache> {
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
    const own = links.filter((link) => sameHost(link.url, home));
    const candidates = heavy
      ? [
          ...own.filter((link) => matchesLink(link, HEAVY_LINK)).map((link) => link.url),
          ...(school.sourceUrl ? [school.sourceUrl] : []),
          ...own.filter((link) => matchesLink(link, PRICE_LINK)).map((link) => link.url),
        ]
      : [
          ...(school.sourceUrl ? [school.sourceUrl] : []),
          ...own.filter((link) => matchesLink(link, PRICE_LINK)).map((link) => link.url),
        ];
    const pages: CachedPage[] = [{ url: home, text: htmlToText(homeHtml) }];
    for (const url of [...new Set(candidates.map((candidate) => normalizeUrl(candidate) ?? ''))]) {
      if (pages.length >= MAX_PAGES) break;
      if (!url || pages.some((page) => page.url === url) || !sameHost(url, home)) continue;
      const html = await getHtml(url, disallow);
      if (html) pages.push({ url, text: htmlToText(html) });
    }
    if (!heavy) return { fetchedAt, ok: true, pages, social };
    const heavySignal =
      pages.some((page) => HEAVY_SIGNAL.test(page.text)) ||
      own.some((link) => matchesLink(link, HEAVY_LINK));
    return { fetchedAt, ok: true, pages, social, heavySignal };
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

function matchesLink(link: { url: string; label: string }, pattern: RegExp): boolean {
  let decoded = link.url;
  try {
    decoded = decodeURIComponent(link.url);
  } catch {}
  return pattern.test(decoded) || pattern.test(link.label);
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(
      /&([aAoO])uml;/g,
      (_, letter: string) => ({ a: 'ä', A: 'Ä', o: 'ö', O: 'Ö' })[letter] ?? letter,
    )
    .replace(/&([aA])ring;/g, (_, letter: string) => (letter === 'a' ? 'å' : 'Å'))
    .replace(/&eacute;/g, 'é')
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

const HEAVY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories', 'ykb', 'prices', 'sourceUrl'],
  properties: {
    categories: { type: 'array', items: { type: 'string', enum: [...HEAVY_CATEGORIES] } },
    ykb: { type: 'boolean' },
    prices: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'kind', 'name', 'minutes', 'hours', 'priceSek'],
        properties: {
          category: { type: 'string', enum: [...HEAVY_CATEGORIES, 'YKB'] },
          kind: { type: 'string', enum: ['LESSON', 'COURSE'] },
          name: { type: 'string' },
          minutes: { type: ['integer', 'null'] },
          hours: { type: ['integer', 'null'] },
          priceSek: { type: 'integer' },
        },
      },
    },
    sourceUrl: { type: ['string', 'null'] },
  },
} as const;

const HEAVY_INSTRUCTIONS = `You read Swedish driving-school web pages and extract what the school publishes about heavy-vehicle training, in SEK including VAT.
Categories: C1, C1E (light truck), C, CE (truck, truck with trailer), D1, D1E (minibus), D, DE (bus). YKB = yrkeskompetensbevis (grundutbildning or fortbildning for professional drivers).
Rules:
- Only use what is written on the pages. Never estimate or infer. Ignore categories B, BE, A, AM and tractors.
- categories: the C/D categories the pages say this school trains for. Empty if none are stated.
- ykb: true only if the pages say the school offers YKB courses.
- prices: every stated price for those categories. kind = LESSON for one driving lesson (minutes = its length), COURSE for a full education, package or YKB course (hours = stated course length in hours, e.g. 35 or 140). category = the licence category, or YKB for YKB courses. name = the product name as written (Swedish, short).
- Skip prices that apply to a company only (offert), and prices "från" ranges without a number.
- sourceUrl: the page URL where most of these prices appear; must be one of the given URLs, or null when no price is stated.`;

async function extractHeavy(
  client: OpenAI,
  model: string,
  school: School,
  fetched: FetchCache,
): Promise<HeavyExtraction> {
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
      json_schema: { name: 'heavy_prices', strict: true, schema: HEAVY_SCHEMA },
    },
    messages: [
      { role: 'system', content: HEAVY_INSTRUCTIONS },
      { role: 'user', content: `School: ${school.name}\n\n${pages}` },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('empty response');
  const extraction = JSON.parse(content) as HeavyExtraction;
  const urls = new Set(fetched.pages.map((page) => page.url));
  if (extraction.sourceUrl && !urls.has(extraction.sourceUrl)) extraction.sourceUrl = null;
  return extraction;
}

function sanitizeHeavy(extraction: HeavyExtraction): HeavyExtraction {
  const bounds = (price: HeavyPrice): [number, number] =>
    price.kind === 'LESSON'
      ? [900, 5_000]
      : price.category === 'YKB'
        ? [1_500, 80_000]
        : [2_000, 150_000];
  const prices = extraction.prices
    .filter((price) => {
      const [min, max] = bounds(price);
      return price.priceSek >= min && price.priceSek <= max;
    })
    .map((price) => ({
      ...price,
      minutes:
        price.minutes != null && price.minutes >= 20 && price.minutes <= 180 ? price.minutes : null,
      hours: price.hours != null && price.hours >= 1 && price.hours <= 400 ? price.hours : null,
    }))
    .filter(
      (price, index, all) =>
        all.findIndex(
          (other) =>
            other.category === price.category &&
            other.priceSek === price.priceSek &&
            other.name.trim().toLowerCase() === price.name.trim().toLowerCase(),
        ) === index,
    )
    .slice(0, 20);
  const categories = [
    ...new Set([
      ...extraction.categories,
      ...prices.flatMap((price) => (price.category === 'YKB' ? [] : [price.category])),
    ]),
  ].filter((category): category is HeavyCategory =>
    (HEAVY_CATEGORIES as readonly string[]).includes(category),
  );
  return {
    categories: HEAVY_CATEGORIES.filter((category) => categories.includes(category)),
    ykb: extraction.ykb || prices.some((price) => price.category === 'YKB'),
    prices,
    sourceUrl: prices.length > 0 ? extraction.sourceUrl : null,
  };
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

function merge(school: School) {
  const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch'));
  const extraction = readJson<Extraction>(cachePath(school.id, 'extract'));
  if (fetched?.social.length) school.social = fetched.social;
  if (!fetched) return;
  school.checkedAt = fetched.fetchedAt.slice(0, 10);
  if (fetched.ok) {
    school.phone = phoneFromPages(fetched.pages);
    school.inbox = emailFromPages(fetched.pages);
  }
  if (!fetched.ok) {
    if (school.status === 'OK') school.status = 'SITE_UNREACHABLE';
    return;
  }
  if (fetched.pages.every((page) => PARKED_PAGE.test(page.text))) {
    school.status = 'SITE_UNREACHABLE';
    clearPrices(school);
    return;
  }
  if (!extraction) return;
  const checked = onlyBPricesOnPage(extraction, fetched);
  const { lesson } = checked;
  school.lesson = {
    priceSek: lesson.priceSek,
    minutes: lesson.minutes,
    pricePerMinuteSek:
      lesson.priceSek && lesson.minutes
        ? Math.round((lesson.priceSek / lesson.minutes) * 10) / 10
        : null,
    note: lesson.note,
  };
  school.testLessonSek = checked.testLessonSek;
  school.risk1Sek = checked.risk1Sek;
  school.risk2Sek = checked.risk2Sek;
  school.packages = checked.packages;
  const priced = checked.intensive.courses.flatMap((course) =>
    course.priceSek == null ? [] : [course.priceSek],
  );
  school.intensive = {
    offered: checked.intensive.offered,
    cheapestPriceSek: priced.length > 0 ? Math.min(...priced) : null,
    courses: checked.intensive.courses,
  };
  const anyPrice =
    lesson.priceSek != null ||
    checked.risk1Sek != null ||
    checked.risk2Sek != null ||
    checked.packages.length > 0 ||
    priced.length > 0;
  school.status = anyPrice ? 'OK' : 'PRICE_NOT_PUBLISHED';
  school.sourceUrl = checked.sourceUrl ?? school.sourceUrl;
}

// A domain-host placeholder or parking page is not the school's website.
const PARKED_PAGE =
  /has not been mapped yet|domain (is )?(for sale|parked)|this domain (may be|is) for sale|domänen (är )?till salu|webbhotell.{0,40}(parkerad|ej aktiv)/i;

function amountOnPages(amount: number, pages: FetchCache['pages']): boolean {
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '[ .,]?');
  const pattern = new RegExp(`(^|[^\\d])${grouped}([^\\d]|$)`);
  return pages.some((page) => pattern.test(page.text.replace(/\u00a0|\u202f/g, ' ')));
}

// The model sometimes fills a typical Swedish price list into a page that has
// none. Every amount must be written on one of the crawled pages.
function onlyBPricesOnPage(extraction: Extraction, fetched: FetchCache): Extraction {
  const seen = (amount: number | null) =>
    amount != null && amountOnPages(amount, fetched.pages) ? amount : null;
  const lessonPrice = seen(extraction.lesson.priceSek);
  return {
    ...extraction,
    lesson: {
      priceSek: lessonPrice,
      minutes: lessonPrice == null ? null : extraction.lesson.minutes,
      note: lessonPrice == null ? null : extraction.lesson.note,
    },
    testLessonSek: seen(extraction.testLessonSek),
    risk1Sek: seen(extraction.risk1Sek),
    risk2Sek: seen(extraction.risk2Sek),
    packages: extraction.packages.filter((pack) => seen(pack.priceSek) != null),
    intensive: {
      offered: extraction.intensive.offered,
      courses: extraction.intensive.courses.map((course) => ({
        ...course,
        priceSek: seen(course.priceSek),
      })),
    },
  };
}

function clearPrices(school: School) {
  school.lesson = { priceSek: null, minutes: null, pricePerMinuteSek: null, note: null };
  school.testLessonSek = null;
  school.risk1Sek = null;
  school.risk2Sek = null;
  school.packages = [];
  school.intensive = { offered: 'UNKNOWN', cheapestPriceSek: null, courses: [] };
}

const HEAVY_NAME_CODE = /(^|[^A-Za-z0-9])(C1E?|CE|C|D1E?|DE|D)([^A-Za-z0-9]|$)/;
const HEAVY_NAME_WORD = /lastbil|buss|tung|ykb|yrkes|fortbildning|grundutbildning|kran/i;
const CAR_NAME =
  /(^|[^A-Za-z0-9])(B|BE|B96)([^A-Za-z0-9]|$)|personbil|halk|risk|moped|motorcykel|(^|\s)mc(\s|$)/i;

// Keeps only prices whose amount is written on one of the crawled pages (as
// 13500, 13 500, 13.500 or 13,500) and that belong to heavy-vehicle training:
// car and trailer items listed on the same page are dropped, and a name that
// names no category at all must come from a heavy-vehicle page.
function onlyPricesOnPage(extraction: HeavyExtraction, fetched: FetchCache): HeavyExtraction {
  const pageWith = (amount: number) => {
    const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '[ .,]?');
    const pattern = new RegExp(`(^|[^\\d])${grouped}([^\\d]|$)`);
    return fetched.pages.find((page) => pattern.test(page.text.replace(/\u00a0|\u202f/g, ' ')));
  };
  const prices = extraction.prices.filter((price) => {
    const page = pageWith(price.priceSek);
    if (!page) return false;
    const heavyName = HEAVY_NAME_CODE.test(price.name) || HEAVY_NAME_WORD.test(price.name);
    if (CAR_NAME.test(price.name) && !heavyName) return false;
    return heavyName || HEAVY_LINK.test(decodeURIComponent(page.url));
  });
  return { ...extraction, prices };
}

// A fresh heavy crawl replaces school.heavy entirely, so training a school no
// longer advertises disappears instead of lingering from an older run.
function mergeHeavy(school: School) {
  const fetched = readJson<FetchCache>(cachePath(school.id, 'fetch', true));
  if (!fetched?.ok) return;
  const cached = fetched.heavySignal
    ? readJson<HeavyExtraction>(cachePath(school.id, 'extract', true))
    : null;
  if (fetched.heavySignal && !cached) return;
  const extraction = cached ? sanitizeHeavy(onlyPricesOnPage(cached, fetched)) : null;
  school.heavy =
    extraction && (extraction.categories.length > 0 || extraction.ykb)
      ? { ...extraction, checkedAt: fetched.fetchedAt.slice(0, 10) }
      : null;
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
    'Tung trafik (behörigheter)',
    'Tung trafik (pris)',
    'Telefon',
    'E-post',
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
      school.heavy
        ? [...school.heavy.categories, ...(school.heavy.ykb ? ['YKB'] : [])].join(', ')
        : '',
      (school.heavy?.prices ?? [])
        .map((price) => `${price.category} ${price.name} – ${price.priceSek}`)
        .join(' | '),
      school.phone?.display,
      school.inbox?.address,
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

function cachePath(id: string, stage: 'fetch' | 'extract', heavy = false): string {
  return path.join(CACHE_DIR, `${id}.${heavy ? 'heavy-' : ''}${stage}.json`);
}

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

function summary(extraction: Extraction): string {
  return `lesson ${extraction.lesson.priceSek ?? '-'} risk1 ${extraction.risk1Sek ?? '-'} risk2 ${
    extraction.risk2Sek ?? '-'
  } packages ${extraction.packages.length}`;
}

function heavySummary(extraction: HeavyExtraction): string {
  return `categories ${extraction.categories.join('/') || '-'} ykb ${extraction.ykb ? 'yes' : 'no'} prices ${
    extraction.prices.length
  }`;
}

function log(index: number, total: number, id: string, message: string | undefined) {
  console.log(`[${index + 1}/${total}] ${id}: ${message ?? ''}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

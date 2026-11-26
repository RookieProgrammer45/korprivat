# School prices dataset (B licence, Sweden)

Snapshot of published prices for every Swedish driving school with B (car)
permission, collected **2026-10-26**. Use it as reference data. It is not
verified evidence: a school has not confirmed any of these prices to
DriveLinkUp.

## Files

| File | What it is |
| --- | --- |
| `school-prices.json` | Canonical dataset: `meta` plus `schools[]`. Use this in code. |
| `school-prices.csv` | Same data flattened (Swedish headers, `;`-separated, UTF-8 BOM) for Excel. |
| `unmatched-listings.json` | DriveLinkUp listings from `docs/cutover-school-roster.json` that could not be linked to exactly one record. |
| `unlisted-schools.json` / `.csv` | Listings whose school publishes no usable price on its website, with the reason. They are listed with a "Prisförfrågan" (price request) button instead of prices. Snapshot. |

## Provenance

- **School list:** [trafikskola.se](https://trafikskola.se), which is built on
  Transportstyrelsen's permit register and STR. It covers all 1,417 branches
  with B permission; branches are grouped into 1,101 schools by website
  domain (or by name when there is no website).
- **Prices:** read from each school's own website or its web shop (homepage
  plus price, intensive and package pages), then extracted into the schema
  below. Spot-checked against manually verified schools.
- **Not covered:** schools with no website, sites that block automated
  access, and schools that only quote on request. See `status`.

## Schema (`schools[]`)

```ts
type SchoolPriceRecord = {
  id: string;                 // stable slug (website domain or name)
  name: string;               // name as shown on the school's site
  listingIds: string[];       // DriveLinkUp listing ids (docs/cutover-school-roster.json); [] if unlinked
  counties: string[];         // län, e.g. "Stockholms län"
  cities: string[];           // branch towns from the register
  registerNames: string[];    // legal/branch names in the register
  website: string | null;
  lesson: {
    priceSek: number | null;  // ordinary price of ONE standard weekday B lesson
    minutes: number | null;   // lesson length (30–80 min; compare with pricePerMinuteSek)
    pricePerMinuteSek: number | null;
    note: string | null;      // campaign, weekend or automatic/manual differences
  };
  testLessonSek: number | null;
  risk1Sek: number | null;    // Riskettan
  risk2Sek: number | null;    // Risktvåan / halkbana
  packages?: {                // bundles sold for one price (not intensive courses)
    name: string;
    lessons: number | null;   // driving lessons included
    contents: string;
    priceSek: number;
  }[];
  social?: string[];          // social profile links found on the school's site (links only)
  checkedAt?: string;         // date this record was last re-collected
  intensive: {
    offered: 'PRICE_LISTED' | 'ON_REQUEST' | 'NOT_MENTIONED' | 'UNKNOWN';
    cheapestPriceSek: number | null;
    courses: { name: string; contents: string; priceSek: number | null }[];
  };
  status:
    | 'OK'
    | 'PRICE_NOT_PUBLISHED'
    | 'NO_WEBSITE'
    | 'SITE_BLOCKED'
    | 'SITE_UNREACHABLE'
    | 'NOT_A_B_SCHOOL_SITE';
  sourceUrl: string | null;   // page the prices were read from
  // Heavy-vehicle training advertised on the site (linked schools only);
  // null when the site advertises none, absent when not yet crawled.
  heavy?: {
    categories: ('C1' | 'C1E' | 'C' | 'CE' | 'D1' | 'D1E' | 'D' | 'DE')[];
    ykb: boolean;             // YKB grundutbildning / fortbildning offered
    prices: {
      category: 'C1' | 'C1E' | 'C' | 'CE' | 'D1' | 'D1E' | 'D' | 'DE' | 'YKB';
      kind: 'LESSON' | 'COURSE';
      name: string;
      minutes: number | null; // lesson length
      hours: number | null;   // stated course length, e.g. YKB 35 or 140 h
      priceSek: number;
    }[];
    sourceUrl: string | null;
    checkedAt: string;
  } | null;
  // The school's phone number as printed on its own site; null when the
  // pages show none or several of equal weight (usually branches).
  phone?: { display: string; e164: string; sourceUrl: string } | null;
  // Inbox printed on the site. Used as the contact button's mailto when the
  // listing has no email of its own; the address is never shown as text.
  inbox?: { address: string; sourceUrl: string } | null;
};
```

Heavy-vehicle categories come from the school's website, not from the permit
register, so they are shown as "according to the school's website".

## Refreshing

`scripts/school-prices/refresh.ts` re-collects the data in three steps:
`--fetch` crawls each school's own website (robots.txt honoured, one request
per host) into `.cache/` (git-ignored), `--extract` turns the cached pages into
prices with OpenAI (needs `OPENAI_API_KEY`), and `--write` rebuilds the JSON,
the CSV and `meta`. Social media is never crawled; Facebook and Instagram
terms forbid automated collection, so only profile links are recorded.

Add `--heavy` to run the same three steps for C/D and YKB into `heavy` (B
prices are left untouched) and `--linked` to limit a run to schools linked to
a listing. `--write` also refreshes `phone` from the cached pages; `--phones`
does only that. `.github/workflows/school-prices-refresh.yml` runs both on the 1st
of every month and opens a pull request; it needs the `OPENAI_API_KEY`
repository secret.

## Coverage (see `meta.counts`)

- 1,101 schools (refreshed 2026-10-26): 481 with a lesson price, 428 with a
  Risk 1 price, 371 with a Risk 2 price, 414 with package prices, 153 with a
  priced intensive course; 387 with a phone number (302 of them linked).
- 581 of the 635 DriveLinkUp listings are linked via `listingIds`; the other
  54 are listed in `unmatched-listings.json`. 49 links were added by hand
  (2026-10-26): each needs a priced record in the same city and either the
  same school name or the exact register company for that website. Links to
  the generic On Via chain page and ambiguous names were left unmatched.

## Rules for using this data

- Show prices as **"published price on the school's website (date)"** and
  link to `sourceUrl`. Never present them as confirmed or verified (see
  `.cursor/rules/drivelinkup.mdc`, evidence rules).
- These prices are not booking or checkout amounts. Money still follows the
  Stripe payment path and the school's own offerings.
- Do not write this data into another bounded context's tables. If it goes
  into the DB, add a migration in the owning context (Discovery) plus an
  import script under `scripts/`.
- Campaign prices go stale. Re-collect before relying on a price, and refresh
  `meta.collectedAt`.
- Lesson lengths and intensive-course contents were extracted automatically;
  check the source before showing them prominently.

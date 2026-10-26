# School prices dataset (B licence, Sweden)

Snapshot of published prices for Swedish driving schools with B (car)
permission, collected **2026-10-26**. Filtered to schools that have a website,
published prices and Google reviews (see Filter below). Use it as reference data. It is not
verified evidence: a school has not confirmed any of these prices to
DriveLinkUp.

## Files

| File | What it is |
| --- | --- |
| `school-prices.json` | Canonical dataset: `meta` plus `schools[]`. Use this in code. |
| `school-prices.csv` | Same data flattened: English snake_case headers, `,`-separated, UTF-8 (no BOM). Multi-value fields use `;`; intensive courses are `name: contents = N SEK` joined by ` \| `. |

## Filter

A school is included only if all of these hold:

- `status` is `OK` (prices were published on its site),
- it has a `website`,
- at least one linked DriveLinkUp listing has Google reviews
  (`Instructor.googleReviewCount > 0` in the DB, Google Places snapshot synced
  2026-10-18).

When a school has several listings, `google` comes from the listing with the
most reviews (`google.fromListingId`).

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
  google: {
    rating: number;           // Google rating 1–5
    reviewCount: number;
    mapsUri: string | null;
    placeId: string | null;
    fromListingId: string;    // listing the Google data was taken from
  };
};
```

## Coverage (see `meta.counts`)

- 157 schools in 21 counties: 153 with a lesson price, 65 with a priced
  intensive course; 183 DriveLinkUp listing ids linked.
- Excluded from the full 1,101-school collection: 201 priced schools without
  Google data in the DB (112 listed on DriveLinkUp but with no confident
  Google match, 89 not on DriveLinkUp), plus every school without published
  prices or a website.

## Rules for using this data

- Show prices as **"published price on the school's website (date)"** and
  link to `sourceUrl`. Never present them as confirmed or verified (see
  `.cursor/rules/drivelinkup.mdc`, evidence rules).
- These prices are not booking or checkout amounts. Money still follows the
  Stripe payment path and the school's own offerings.
- Do not write this data into another bounded context's tables. If it goes
  into the DB, add a migration in the owning context (Discovery) plus an
  import script under `scripts/`.
- Google ratings are a cached snapshot; render them from the DB
  (`Instructor.googleRating`), not from this file, so they stay fresh.
- Campaign prices go stale. Re-collect before relying on a price, and refresh
  `meta.collectedAt`.
- Lesson lengths and intensive-course contents were extracted automatically;
  check the source before showing them prominently.

# Category landing browser verification

**Authority:** walkthrough gap on `CATEGORY_OFFERINGS` (`docs/v1.2-production-readiness-walkthrough.md`).  
**Ran:** 2026-10-26. Cloud browser on localhost + production GET.  
**Production writes:** none. Vercel env vars: not changed. `CATEGORY_OFFERINGS` not flipped.  
**Staging preview SSO:** Vercel share-link APIs returned 403 (`read_protection_bypass` on `dpl_FejZzuZtxGgjuTR673P8MTAVkNuH`). Flag-on pages were opened locally with `CATEGORY_OFFERINGS=1 npm run dev -- --port 3010` (documented equivalent).

This document does not authorize a production flag flip.

## Method

| Surface | URL | Flag | Claim |
| --- | --- | --- | --- |
| Production (GET only) | `https://www.drivelinkup.com/kategori/B` | unset | **[OBSERVED-MVP]** branded 404 |
| Local, flag on | `http://localhost:3010/kategori/{A,B,C}` | `CATEGORY_OFFERINGS=1` in the process | **[OBSERVED-MVP]** category-specific heading + i18n body |
| Local, invalid slug | `http://localhost:3010/kategori/ZZ` | on | **[OBSERVED-MVP]** HTTP 404 |
| Vercel preview | `korprivat-7wn1sutgd-rookieprogrammer45.vercel.app/kategori/B` | unknown; share link 403 | **[OBSERVED-MVP]** access blocked — not a page result |

Screenshots: `docs/evidence/category-landing/`.

## What rendered

### Flag off (production)

`/kategori/B` is the branded 404 (“This page does not exist.” / Back to home).  
Document title was `-utbildning · DriveLinkUp` because `generateMetadata` ignored the route param (fixed in this PR). No offering list, no policy version, no resource bundle.

Evidence: `production-flag-off-B-404.png`.

### Flag on (local)

Server-rendered pages. No raw i18n keys. Headings and copy are category-specific and locale-specific:

| Route | sv (before locale switch) | en (after Change language → EN) |
| --- | --- | --- |
| `/kategori/B` | **B-utbildning**. Body: teaching-permission rule + “no booking surface”. Empty: “Inget utbud i den här kategorin.” | **B training**. Body: “Offerings appear here only when the school holds current teaching permission for this category. This page has no booking surface.” Empty: “No offerings in this category.” |
| `/kategori/A` | **A-utbildning** + same policy body | **A training** + same English policy body |
| `/kategori/C` | **C-utbildning** + same policy body | not re-opened after the locale switch |

Evidence: `local-flag-on-B-en.png`, `local-flag-on-A-en.png`.  
HTML on `/kategori/B` (curl): `h1` = `B-utbildning`, `policyVersion` string count = 0.

Empty state is expected: Neon/local `CategoryOffering` rows for these slugs were not present. The page lists `category` + optional ` · v{policyVersion}` only. It has no booking CTA.

### Invalid category

`GET /kategori/ZZ` → HTTP 404 (`__next_error__` payload). The automation browser did not paint `src/app/not-found.tsx` (blank viewport). Production 404 for the same route family does paint the branded page. Not treated as an app-logic break; reported below.

## Fix applied (only what was broken)

`generateMetadata` called `t('title', { category: '' })`, so every category tab title was `-utbildning` / `training`. It now uses the route param when `isOfferingCategory` matches. After the fix, local `/kategori/B` title is **B training · DriveLinkUp** **[OBSERVED-MVP]**.

## Gaps (not fixed)

1. **No resource-bundle field.** `CategoryOffering` stores `category`, `policyId`, `policyVersion`. The landing renderer prints category + version. Instructor / vehicle / location from specs/09 §6 `resource_bundle` are not on this model and were not invented. Walkthrough PARTIAL note stands.
2. **`robots: { index: false }`.** Acquisition SEO indexing stays off. Not flipped here.
3. **Empty supply on the verified pages.** No synthetic listings were inserted. A populated landing (category + `v{n}`) was not browser-exercised.
4. **Vercel preview SSO.** Share-link create/read returned 403. Flag-on proof is local only.
5. **Local invalid-slug 404 UI.** HTTP 404 is correct; branded not-found did not paint in the automation browser. Production branded 404 does.

## Verdict

`CATEGORY_OFFERINGS` landing: **PARTIAL → browser-verified for empty, permission-copy pages**. Resource-bundle UI remains a gap. Production flag stays off.

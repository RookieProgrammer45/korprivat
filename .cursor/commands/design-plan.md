# Design plan — apply design-system.mdc (Plan mode, no code)

Run this in **Plan mode** with a reasoning model (Claude Opus 5.5, high thinking).
Optional argument: a page or section to limit the plan to (e.g. `/design-plan school cards` or `/design-plan /instructors`). With no argument, plan the whole public home page plus header, footer and cookie banner.

## Context to load

- @.cursor/rules/design-system.mdc (the design system — follow it exactly)
- @.cursor/rules/drivelinkup.mdc (product honesty rules — these win on conflict)
- @.cursor/rules/page-backgrounds.mdc (solid backgrounds only)
- @AGENTS.md
- @src/components/custom/home-hero.tsx — the **approved reference implementation**. Match its quality, tokens and patterns everywhere else.

## Do NOT write code. Produce a plan only.

### 1. Collect references (Mobbin MCP)
For each section in scope, pull 4–8 references from shipped products: Airbnb, Booking.com, Treatwell, Doctolib, Zocdoc, Thumbtack, Linear, ElevenLabs. Summarise each section's shared pattern in 5 bullets: layout, hierarchy, above-the-fold content, how trust is shown, mobile behaviour. If the Mobbin MCP is not connected, say so and stop.

### 2. Audit
List every violation of design-system.mdc with `file:line`. Default scope:
- `src/components/custom/public-home.tsx` — sections after `<HomeHero />` (#how, providers, assurance, entry, footer prompt)
- `src/components/custom/instructor-preview.tsx` — school cards
- `src/components/custom/consent-banner.tsx`
- `src/components/custom/site-nav.tsx` — header
- site footer (custom-style.css §17, "Magic-UI footer-1")
- `src/app/custom-style.css` rules that fight the system (e.g. the `nth-child(2)` offset on assurance cards, double-class specificity overrides)

### 3. Confirm these known problems in code and plan a fix for each
- **School cards:** broken logo shows alt text; no initials fallback; "Ingen kommande tid listad" rendered when empty; unlabeled "B" chip; price not prominent.
- **"Inget gömt i småtexten":** middle card is staggered lower; cards must share height.
- **Repeated disclaimer:** the listing/booking-authorization clarification appears in the hero note, the assurance "safety" card and the footer blurb. Keep it **once per page** (the hero note covers the home page). Give exact **before/after copy (sv + en)** for every occurrence you change, same legal meaning, for my approval.
- **"Så fungerar det":** text-only; add lucide icons (`size-5`, `strokeWidth={1.75}`).
- **Final CTA:** one ink-pill primary + a text link, not two equal buttons.
- **Cookie banner:** covers ~40% of the mobile viewport; make it a slim bottom bar (≤25% of first viewport). Consent logic and button semantics unchanged.
- **Header wordmark:** `text-xs`; make it readable, keep the logo mark.

### 4. Output
An ordered task list, **one section per task**, each with:
- files to touch
- the Mobbin pattern it follows
- new i18n keys (sv + en)
- acceptance checks from design-system.mdc §11

Save the plan to `tasks/design-plan.md` and stop.

## Hard constraints
- No invented data: no fake ratings, counts, slots, names, prices or testimonials. Numbers only if computed from the database.
- All strings in `messages/sv.json` + `messages/en.json`, both in the same change.
- Solid page backgrounds, one green accent, no-bold policy (headings 400, emphasis 500).
- UI only — do not touch booking, payment, verification, consent or API logic.
- Do not rename routes.

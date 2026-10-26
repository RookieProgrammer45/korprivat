# Design apply — implement one task from the design plan (Agent mode)

Run in **Agent mode** (Composer 2.5 or Auto). Pass the task as the argument, e.g. `/design-apply task 1` or `/design-apply school cards`. If no argument is given, take the first unchecked task in `tasks/design-plan.md`. Do exactly **one** task per run.

## Context to load
- @.cursor/rules/design-system.mdc
- @.cursor/rules/drivelinkup.mdc
- @src/components/custom/home-hero.tsx (reference implementation)
- @tasks/design-plan.md (the approved plan — if it doesn't exist, stop and tell me to run `/design-plan` first)

## Implementation rules
- Follow design-system.mdc exactly and reuse the hero's patterns: white `rounded-[1.25rem]` cards on bone, hairline `border-border`, ink-pill primary button, `rounded-full` chips, lucide icons, `marketplace-reveal` motion.
- New CSS goes in a **new numbered block at the end** of `src/app/custom-style.css`. Do not add more double-class specificity hacks. If an older rule blocks you, delete or narrow it and say which one.
- Hide empty data instead of rendering placeholders. Add an initials fallback for every logo/avatar.
- Add sv + en strings together. Use only compliance copy that was approved in the plan.
- Touch only the files listed for this task. UI only — no booking, payment, verification, consent or API logic.

## Verify before reporting
1. `npm run typecheck && npx biome check <touched files>` — fix any issues you introduced.
2. `npm run dev:check`, then `npm run dev`. Screenshot `http://localhost:3000` at **390×844** and **1440×900** with the browser tool. Check:
   - no horizontal scroll at 320px and 390px
   - no clipped, overlapping or wrapping-mid-word text
   - no broken images or visible alt text
   - cards in a row share height
   - AA contrast on all text; visible focus rings
   - no raw i18n keys rendered
3. Compare against the Mobbin references for this task and fix obvious gaps in spacing and hierarchy.

## Report
- What changed (files + one line each)
- Screenshots (mobile + desktop)
- Pre-existing test/lint failures — report them, do **not** "fix" unrelated tests
- Anything that needs my decision

Then tick the task in `tasks/design-plan.md` and commit: `feat(design): <section>`.

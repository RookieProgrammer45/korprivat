# 04 — Verification Module (the core differentiator)

**Req ID prefix:** VF. Implements plan §8. This module decides what may be shown and sold; the booking engine consumes its verdicts.

## 1. Claim-to-evidence table (Sweden first — canonical per-check definitions)

| Fact to establish | check_type | Required evidence | Tool (Sweden) | Access status |
|---|---|---|---|---|
| Company exists and is active | `company_exists` | Official business-register record | Bolagsverket free tier + paid Företagsinformation API | [EXTERNAL] Officially documented; production access untested |
| Person represents that company | `signatory_authority` | Signatory match or documented delegation | Bolagsverket firmateckning lookup (personnummer + organisationsnummer) | [EXTERNAL] Officially documented; production access untested |
| School may provide the advertised instruction | `school_teaching_permit` | Transportstyrelsen permit (Lag 1998:493) incl. categories | Consent-based public e-service; no authorized/public API verified | [EXTERNAL] Verified e-service; API unverified |
| Individual may teach | `instructor_teaching_permit` | Approved trafiklärare + school affiliation | Transportstyrelsen verification workflow (manual, dated evidence) | [EXTERNAL] Workflow; no authorized/public API verified |
| STR membership (secondary trust signal) | `association_membership` | STR "Hitta trafikutbildare" lookup | Public search | [EXTERNAL] Verified public search |
| Student may take this lesson | `contact_verification` + market rules | Verified contact; e-ID optional; school-side check at first lesson | Twilio Verify; e-ID broker | [PROPOSED] |

**Bolagsverket signing modes and onboarding acceptance (canonical):** JA ENSAM — accept on identity match; JA TILLSAMMANS — one participant's authentication is insufficient, obtain the required combination's approval or reviewed delegation; JA LÖPANDE — do not assume ordinary-course authority covers the marketplace agreement, review its scope; JA FULLMAKT — inspect the mandate (Bolagsverket does not hold it). A director/officer match alone never establishes authority.

## 2. Official-source matrix (per market)

| Market | Business register | Teaching-permission route | Gating notes |
|---|---|---|---|
| Sweden | [Bolagsverket API](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/apiforatthamtaforetagsinformation.3988.html) (free tier + paid signatory API) | [Transportstyrelsen e-service](https://www.transportstyrelsen.se/sv/vagtrafik/e-tjanster-och-blanketter/e-tjanster-inom-vagtrafik/) (consent-based) | Lag (2022:818) = Open Data Act, grants no independent access right |
| Norway | [Brreg open API](https://data.brreg.no/enhetsregisteret/api/docs/index.html) (NLOD) | [Vegvesen public search](https://www.vegvesen.no/forerkort/ta-forerkort/finn-godkjent-trafikkskole/) | No authorized/public API verified |
| Denmark | [CVR via virk.dk](https://datacvr.virk.dk) (free incl. system-to-system) | Documentary påtegning / § 24 approval + [aktindsigt](https://www.fstyr.dk/kontakt/aktindsigt) for current status | Current-status disclosure unconfirmed — launch gate |
| Finland | [PRH/YTJ open API](https://avoindata.prh.fi/ytj.html/info/swagger-ui) | [Traficom "Tarkista kuljettajan tiedot"](https://traficom.fi/fi/autoilijat/ajokortit/tarkista-kuljettajan-tiedot) (instructor); school route open | School-permit lookup unresolved — launch gate |
| Iceland | Skatturinn API — [terms](https://api.skatturinn.is/product): permitted use for DriveLinkUp's verification workflow **requires confirmation** (the terms neither clearly permit nor exclude it; raw-data redistribution restricted; pricing not stated) | island.is public instructor search UI (JS-loaded records; not retrieved in research) | e-ID broker support unverified |
| UK | [Companies House free API](https://developer.company-information.service.gov.uk/) | [DVSA ADI register](https://www.gov.uk/government/publications/whats-involved-in-being-a-driving-instructor/approved-driving-instructor-adi-register-guide) (email/phone verify) | — |

[EXTERNAL — key URLs inline above; the full evidence log is in the Product Development Plan v5 (companion deliverable). Do not treat "documented" as "production access tested"; do not treat "Advertised" vendor pages as verified facts.]

## 3. Identity layer (e-ID broker shortlist)

Shortlist (no winner): Criipto, Signicat, Didit. All three proceed to sandbox tests and production-onboarding quotes; choice on comparable all-in costs at stated volumes, live production eID coverage (Iceland separately verified), and integration effort. [EXTERNAL — vendor pages, Advertised; published prices are not comparable all-in offers]

Student e-ID is **optional** (Swedish BankID age limits are bank-set, "most commonly 13 or 18"; under-18s always need guardian consent — 16–17-year-olds may hold BankID but cannot be assumed to. Sources: [bankid.com](https://www.bankid.com/en/individuals/get-bankid), [elegitimation.se](https://www.elegitimation.se/skaffa-e-legitimation)).

## 4. Permission-gating rules (canonical — NN1–NN3)

| Situation | Effect on offering |
|---|---|
| Never verified (no pass record for a required check_type) | Bookable offering cannot activate |
| Previously verified, evidence still valid, directory outage | Offering stays live, flagged for re-check |
| Confirmed expired/revoked permit | Offering disabled pending resolution; identity verification preserved |
| Mismatch of legal entity/location/category/scope | Offering disabled pending resolution |
| STR membership not found | No membership badge; no review block |

Re-verification schedules per check_type; scope is matched to the legal entity and its applicable location/category/scope, not a similar school name.

## 5. Exception-based document verification (students)

Full documentary KYC is **not the default** for students. Step-up only where a specific obligation or substantiated fraud risk warrants it. Candidates: Stripe Identity ($1.50/completed verification, first 50 free — [stripe.com/identity](https://stripe.com/identity); Advertised pricing, re-confirm at contracting; confirm under-18 support before routing minors there); payment-provider onboarding KYB. **Document retention (canonical, aligns with DM evidence_refs):** the default stores the result + a protected reference (hash or external vault ref), never the document image. Documentary permit review (e.g. Danish påtegning) may temporarily collect an authorized document during review; the raw document is deleted on completion per retention config, and the retained artifact is the result + reference (release test f constrains the default path). Biometric processing, if enabled, requires a documented biometric-processing condition, processor/controller roles, and retention arrangements **before** enabling — a generic GDPR statement is insufficient.

## 6. Per-market launch gates

- Sweden: buildable now (workflows + Bolagsverket when access obtained).
- Denmark/Finland: gated on permit-status disclosure routes (authority inquiries drafted, unsent).
- Iceland: gated on Skatturinn license confirmation + broker support.
- Every EU row in the plan register is a research entry, not a launch commitment.

## 7. Guardian consent (minors)

- Guardian identity is **not** proof of guardianship or of consent to this specific booking. The minor flow collects: relationship/authority evidence (per-market, counsel-reviewed) + exactly what the consent covers (account creation, booking, data processing).
- A guardian-consent flow for a 16-year-old must complete without an e-ID requirement on the student (release test g).

## 8. Data minimization

- Receiving a personnummer does not justify retaining it: minimum necessary identifiers per check; restricted exposure in logs and support views; retention/deletion per check type (evidence_refs.retention_until).
- Personnummer-type identifiers encrypted at rest (AR-4).

## 9. Release tests (§8.7 → Given/When/Then, canonical)

| ID | Given/When/Then |
|---|---|
| VF-a | Given a school rep without a signatory match, when onboarding, then completion is blocked without delegation review. |
| VF-a2 | Given JA FULLMAKT, when onboarding, then the route is manual mandate inspection, not auto-approval. |
| VF-a3 | Given JA TILLSAMMANS with only one participant authenticated, when onboarding, then completion is blocked. |
| VF-a4 | Given JA LÖPANDE, when onboarding, then a documented scope review of the marketplace agreement is required before activation. |
| VF-b | Given a student with verified contact but no e-ID, when booking where market rules allow, then the booking proceeds. |
| VF-c | Given an expired permit, when gating runs, then the affected offering is disabled pending resolution while identity verification is preserved. |
| VF-c2 | Given a never-verified school, when activation is attempted, then the bookable offering cannot activate. |
| VF-d | Given STR "not found", when badge logic runs, then no membership badge and no review block. |
| VF-e | Given a failed Twilio verification, when booking confirmation is attempted, then confirmation is blocked but browsing is unaffected. |
| VF-f | Given a completed document check, when stored, then the result + reference are stored, not the document image. |
| VF-g | Given a guardian-consent flow for a 16-year-old, when completed, then it completes without an e-ID requirement on the student and the relationship/authority evidence is recorded. |
| VF-h | Given an entity outside the PRH/YTJ API's documented coverage, when verification runs, then it routes to manual review, not rejection. |
| VF-i | Given a Finnish instructor verification, when evidence is produced, then it must explicitly establish the named person's current instructor permission (authenticated Traficom service result, confirmed official alternative, or an extract that explicitly shows the permit) before the badge activates — an extract that does not explicitly establish the permit does not qualify. |
| VF-j | Given a Danish instructor onboarding, when evidence is collected, then the kørekort with påtegning (ordinary) or written § 24 approval (recognition route) is collected as documentary evidence, and the verified badge requires a positive aktindsigt/status confirmation — a submitted-but-unanswered request does not activate it. |
| VF-j2 | Given a Finnish autokoululupa verification, when the school's offering activates, then a positive permit confirmation (tietopyyntö/single-disclosure outcome or confirmed § 226 coverage) exists — a pending inquiry does not qualify. |

## 10. Claim alignment (fixes B2)

The "Verifierad/auktoriserad" badge displays only when stored evidence exists (date + method). Homepage and FAQ text must match actual practice exactly. The DMCC/FTC-aligned pattern applies to every later market.

## 11. B3 fix — instructor eligibility (Sweden)

Instructor signup must require school affiliation **and** documented individual approval wherever rules require both (paid instruction in Sweden requires a traffic-school permit and approved trafiklärare, Lag 1998:493). Remove the "körkort i minst 5 år" criterion as a "certified" claim.

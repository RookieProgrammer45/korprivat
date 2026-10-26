//
// Server-only module: the assistant receives a small, auditable set of
// marketplace facts and hands personal or safety-sensitive cases to the
// existing contact flow. Dynamic rates come from the same seed rows used by
// the provider directory so the public answer does not invent a range.

import 'server-only';
import { seedRows } from '@/lib/business/instructor-seeds';
import { CONTACT_TOPICS, type ContactTopic } from '@/lib/contact/schema';
import type { Locale } from '@/lib/contracts/chatbot';

interface RateRange {
  min: number;
  max: number;
}

function deriveRateRange(rows = seedRows): RateRange {
  if (rows.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const row of rows) {
    if (row.hourlyRateSek < min) min = row.hourlyRateSek;
    if (row.hourlyRateSek > max) max = row.hourlyRateSek;
  }
  return { min, max };
}

const CATEGORY_FACTS: Record<Locale, string> = {
  en: [
    'DriveLinkUp is a catalog that lists driving-school profiles for Swedish licence categories including AM, A1, A2, A, B and BE. Learners compare listings and contact the school.',
    'AM covers moped, A1 and A2 cover light and mid-size motorcycles, A covers unrestricted motorcycles, B covers cars, and BE covers cars with heavier trailers.',
    'The exact categories are shown on each school listing; not every school covers every category.',
  ].join('\n'),
  sv: [
    'DriveLinkUp är en katalog som listar trafikskoleprofiler för svenska körkortskategorier som AM, A1, A2, A, B och BE. Elever jämför annonser och kontaktar skolan.',
    'AM gäller moped, A1 och A2 lätta och medeltunga motorcyklar, A motorcyklar utan begränsning, B personbil och BE bil med tyngre släp.',
    'De exakta kategorierna visas på varje skolannons; alla skolor täcker inte alla kategorier.',
  ].join('\n'),
};

const PRICING_FACTS = ({ min, max }: RateRange, locale: Locale): string => {
  if (locale === 'sv') {
    return [
      'Trafikskolornas publicerade timpriser i den aktuella katalogen ligger mellan ' +
        min +
        ' och ' +
        max +
        ' SEK.',
      'Varje skola sätter sitt eget lektionspris, som visas på annonsen.',
      'Eleven betalar skolans publicerade lektionspris. DriveLinkUp lägger inte på någon separat avgift.',
    ].join(' ');
  }
  return [
    'Published school lesson prices in the current directory range from ' +
      min +
      ' to ' +
      max +
      ' SEK per hour.',
    'Each school sets its own lesson price, which is shown on the listing.',
    'The learner pays the published school price. DriveLinkUp adds no separate learner fee.',
  ].join(' ');
};

const CATALOG_FACTS: Record<Locale, string> = {
  en: [
    'DriveLinkUp does not take lesson reservations or lesson payments.',
    'Compare schools by city, licence category, language and published price, then use Contact the school.',
    'Lesson times, terms and payment are arranged with the school.',
  ].join('\n'),
  sv: [
    'DriveLinkUp tar inte emot lektionstider eller lektionsbetalning.',
    'Jämför skolor efter stad, körkortskategori, språk och publicerat pris. Använd sedan Kontakta skolan.',
    'Tider, villkor och betalning ordnas med skolan.',
  ].join('\n'),
};

const TERMS_FACTS: Record<Locale, string> = {
  en: [
    'Each school sets its own lesson terms.',
    'Ask the school about times, cars and what happens if a lesson cannot go ahead.',
    'DriveLinkUp does not set or collect lesson fees.',
  ].join('\n'),
  sv: [
    'Varje skola sätter sina egna villkor.',
    'Fråga skolan om tider, bil och vad som gäller om en lektion inte kan genomföras.',
    'DriveLinkUp sätter inte och tar inte in lektionsavgifter.',
  ].join('\n'),
};

const SAFETY_FACTS: Record<Locale, string> = {
  en: [
    'A listing is not a teaching permit. Identity verification does not prove permission to teach. Confirm the school’s permission for the category and location with the school.',
    'Swedish handledare follow a separate private practice path with their own requirements; they are not authorized driving schools.',
    'Learners should read the listing, ask questions and confirm the lesson setup before starting.',
  ].join('\n'),
  sv: [
    'En annons är inte ett undervisningstillstånd. Identitetskontroll visar inte att någon får undervisa. Bekräfta skolans behörighet för kategori och plats med skolan.',
    'Svenska handledare följer en separat privat väg med egna krav och är inte auktoriserade trafikskolor.',
    'Elever bör läsa annonsen, ställa frågor och bekräfta lektionsupplägget före start.',
  ].join('\n'),
};

const PROVIDER_PATH_FACTS: Record<Locale, string> = {
  en: [
    'A driving school listing can publish categories, prices and availability. Professional instruction requires the school’s own teaching permission; DriveLinkUp does not grant that permission.',
    'A supervisor (handledare) supports supervised practice driving and must meet the applicable Swedish requirements. The learner and supervisor should confirm the requirements for their situation before driving.',
  ].join('\n'),
  sv: [
    'En trafikskoleannons kan visa kategorier, priser och tider. Professionell undervisning kräver skolans eget tillstånd; DriveLinkUp ger inte det tillståndet.',
    'En handledare stöttar vid övningskörning och måste uppfylla tillämpliga svenska krav. Elev och handledare bör bekräfta kraven för sin situation före körningen.',
  ].join('\n'),
};

const RECEIVE_GUIDANCE: Record<Locale, string> = {
  en: [
    'You are the DriveLinkUp support assistant. Answer routine learner questions about licence categories, directory listings, published prices and how to contact a school. DriveLinkUp does not take lesson reservations or lesson payments. Do not say a listing is authorized or regulator-approved unless that is stored evidence.',
    'Keep replies short: one short paragraph or a small bullet list. Use a friendly, factual tone. Do not invent provider credentials, availability, prices, refunds or payment status.',
    'Do not discuss private school-account operations. For a personal payment, refund, safety or credential case, hand off to support.',
  ].join('\n'),
  sv: [
    'Du är DriveLinkUps supportassistent. Svara på rutinfrågor om körkortskategorier, katalogannonser, publicerade priser och hur man når en skola. DriveLinkUp tar inte emot lektionstider eller lektionsbetalning. Säg inte att en annons är auktoriserad eller myndighetsgodkänd utan lagrad evidens.',
    'Håll svaren korta: en kort paragraf eller en liten punktlista. Använd en vänlig och faktamässig ton. Hitta inte på leverantörsbehörighet, tillgänglighet, priser, återbetalningar eller betalningsstatus.',
    'Diskutera inte skolkontots interna drift. Vid ett personligt betalnings-, återbetalnings-, trygghets- eller behörighetsärende ska du hänvisa till support.',
  ].join('\n'),
};

const HANDOFF_GUIDANCE: Record<Locale, string> = {
  en: [
    'When the user asks about a personal payment, refund, safety concern, credential concern, a specific school, or anything requiring human judgement, end the reply with this exact two-line block on its own:',
    '',
    'HANDOFF: talk_to_human',
    'TOPIC: <one of: booking_issue | instructor_question | payment | technical | press | other>',
    '',
    'Use payment for a charge or refund at a school; technical for a broken page or error; instructor_question for a school or credential question; booking_issue for a question about reaching a school; press for media or partnership; otherwise other.',
    'For ordinary questions about categories, published pricing or the absence of a separate learner fee, answer directly without the handoff block.',
  ].join('\n'),
  sv: [
    'När användaren frågar om en personlig betalning, återbetalning, trygghetsfråga, behörighetsfråga, en specifik skola eller något som kräver mänsklig bedömning ska svaret avslutas med exakt detta tvåradiga block på egna rader:',
    '',
    'HANDOFF: talk_to_human',
    'TOPIC: <ett av: booking_issue | instructor_question | payment | technical | press | other>',
    '',
    'Använd payment för debitering eller återbetalning hos skolan; technical för trasig sida eller fel; instructor_question för skola eller behörighet; booking_issue för en fråga om att nå en skola; press för media eller partnerskap; annars other.',
    'För vanliga frågor om kategorier, publicerade priser eller att ingen separat elevavgift tas ut ska du svara direkt utan handoff-blocket.',
  ].join('\n'),
};

function languageDirective(locale: Locale): string {
  return locale === 'sv'
    ? 'Svara på svenska om användaren skrev på svenska, annars på engelska. Matcha användarens språk.'
    : 'Reply in English unless the user wrote in Swedish, in which case reply in Swedish. Match the user.';
}

export function buildSystemPrompt(locale: Locale, rows = seedRows): string {
  const range = deriveRateRange(rows);
  return [
    RECEIVE_GUIDANCE[locale],
    '',
    '--- FACTS ---',
    CATEGORY_FACTS[locale],
    '',
    PRICING_FACTS(range, locale),
    '',
    CATALOG_FACTS[locale],
    '',
    TERMS_FACTS[locale],
    '',
    SAFETY_FACTS[locale],
    '',
    PROVIDER_PATH_FACTS[locale],
    '',
    '--- HANDOFF ---',
    HANDOFF_GUIDANCE[locale],
    '',
    '--- LANGUAGE ---',
    languageDirective(locale),
  ].join('\n');
}

// Extract a structured (topic | none) from the upstream assistant text.
// The route handler keeps the topic null when the protocol is malformed.
export function extractContactTopic(assistantText: string): ContactTopic | null {
  const handoff = assistantText.match(/^\s*HANDOFF:\s*talk_to_human\s*$/m);
  if (!handoff) return null;
  const topicMatch = assistantText.match(/^\s*TOPIC:\s*(\w+)\s*$/m);
  const candidate = topicMatch?.[1];
  if (!candidate) return null;
  if ((CONTACT_TOPICS as readonly string[]).includes(candidate)) {
    return candidate as ContactTopic;
  }
  return null;
}

// Strip the trailing handoff protocol from the assistant text shown to users.
export function stripHandoffBlock(assistantText: string): string {
  return assistantText
    .replace(/\n?\n?\s*HANDOFF:\s*talk_to_human\s*\n\s*TOPIC:\s*\w+\s*$/m, '')
    .trimEnd();
}

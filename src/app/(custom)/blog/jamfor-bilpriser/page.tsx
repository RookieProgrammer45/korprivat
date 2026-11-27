import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/jamfor-bilpriser';
const TITLE = 'Jämför publicerade bilpriser: annons, frånpris och MSRP';
const DESCRIPTION =
  'Ett bilpris på DriveLinkUp är beloppet handlaren eller tillverkaren skrivit på sin egen sida. Jämför bara samma valuta. Ett frånpris är ett golv. Ett MSRP är inte återförsäljarens pris.';
const PUBLISHED = '2026-11-27';

const FAQ = [
  {
    question: 'Vad är ett publicerat bilpris?',
    answer:
      'Det är beloppet som handlarens eller tillverkarens egen sida anger för en namngiven modell. DriveLinkUp visar det beloppet och länkar till sidan. DriveLinkUp säljer inte bilen.',
  },
  {
    question: 'Vad är skillnaden mellan annonspris, frånpris och MSRP?',
    answer:
      'Annonspriset gäller bilen sidan visar. Ett frånpris är det lägsta belopp sidan publicerar, inte priset på varje exemplar. MSRP är tillverkarens annonserade utgångspris. Återförsäljaren sätter försäljningspriset.',
  },
  {
    question: 'Kan jag jämföra kronor och dollar i samma lista?',
    answer:
      'Nej. En låg siffra i dollar är inte ett lägre pris än en krona. Katalogen håller varje valuta för sig.',
  },
  {
    question: 'Varför saknas en stad eller ett land?',
    answer:
      'En rad finns när en handlares eller tillverkares egen sida namngav modellen och ett belopp. En sida som inte gick att läsa, eller som inte visade något belopp, ger ingen rad.',
  },
] as const;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['jämför bilpriser', 'bilpris', 'begagnad bil', 'MSRP', 'frånpris', 'bilhandlare'],
  alternates: publicAlternates(path),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    url: absoluteUrl(path),
    publishedTime: PUBLISHED,
  },
};

export default function JamforBilpriserPage() {
  const url = absoluteUrl(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: TITLE,
        description: DESCRIPTION,
        datePublished: PUBLISHED,
        dateModified: PUBLISHED,
        inLanguage: 'sv-SE',
        author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
        publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Bilpriser · 27 november 2026</p>
          <h1 className="font-display text-h1 text-balance leading-tight tracking-tight">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Ett bilpris på DriveLinkUp är beloppet som handlaren eller tillverkaren har skrivit på
            sin egen sida. Jämför bara belopp i samma valuta. Ett frånpris är ett golv. Ett MSRP är
            tillverkarens annonserade utgångspris, inte priset återförsäljaren säljer bilen för.
          </p>
        </header>
        <div className="grid gap-8 text-body text-foreground">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Vad visar kortet?</h2>
            <p>
              Kortet visar modell, pris och valuta. År, drivmedel och växellåda visas när sidan
              angav dem. Länken öppnar sidan som priset kommer från. DriveLinkUp säljer inte bilen
              och kallar inte handlaren verifierad.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Annonspris, frånpris och MSRP är tre olika belopp
            </h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                Annonspriset gäller den bil handlarens sida visar, med de specifikationer sidan
                anger.
              </li>
              <li>
                Frånpriset är det lägsta belopp sidan publicerar för modellen. Det är inte priset på
                varje exemplar.
              </li>
              <li>
                MSRP är tillverkarens annonserade utgångspris. Återförsäljaren sätter
                försäljningspriset, och det kan innehålla utrustning och avgifter som MSRP inte
                visar.
              </li>
            </ul>
            <p>
              Två belopp som lästes den 27 november 2026: Ford anger 37 290 USD som starting MSRP
              för 2026 F-150 på{' '}
              <a
                className="underline underline-offset-4"
                href="https://www.ford.com/new-trucks/"
                rel="noopener noreferrer"
                target="_blank"
              >
                ford.com/new-trucks
              </a>
              . Renault Brasilien anger Kwid från 71 390 BRL på{' '}
              <a
                className="underline underline-offset-4"
                href="https://www.renault.com.br/"
                rel="noopener noreferrer"
                target="_blank"
              >
                renault.com.br
              </a>
              . Korten behåller den etiketten.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Jämför inte en krona med en dollar
            </h2>
            <p>
              En låg siffra i dollar är inte ett lägre pris än en högre siffra i kronor. Katalogen
              grupperar valutan först, och sorterar beloppet inom den valutan. Byt land när du vill
              se en annan marknad.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Var finns priserna?</h2>
            <p>
              Handlares lager, när deras egen sida visade bilarna, finns för Sverige, Danmark och
              Norge. Tillverkarsidor som namngav modell och belopp finns för USA, Mexiko, Brasilien,
              Chile, Colombia, Frankrike, Storbritannien, Spanien, Italien, Nederländerna, Finland
              och Polen. Ett land eller en stad saknas när ingen sådan sida lästes. Volvo Cars
              amerikanska lagersida gick inte att läsa den 27 november 2026, så de
              återförsäljarpriser som redan fanns står kvar från dagen innan.
            </p>
            <p>
              Ortfiltret matchar handlarens stad, inte ett område runt staden. En sökning på New
              York visar inte en bil hos en handlare i Rochester.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Vanliga frågor</h2>
            {FAQ.map((item) => (
              <div key={item.question} className="grid gap-1">
                <h3 className="font-medium">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </section>
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
            <Button asChild>
              <Link href="/bilhandlare">Jämför bilpriser</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/blog/vad-kostar-besiktning">Läs om besiktningspris</Link>
            </Button>
          </div>
        </div>
      </article>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </main>
  );
}

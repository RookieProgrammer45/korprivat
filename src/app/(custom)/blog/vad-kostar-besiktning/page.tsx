import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/vad-kostar-besiktning';
const TITLE = 'Vad ett publicerat besiktningspris betyder';
const DESCRIPTION =
  'Besiktningspriset är beloppet stationen eller föreskriften publicerat. Frånpris är ett golv, fast pris är det angivna beloppet, och ett högsta pris är ett tak. DriveLinkUp bokar inte besiktningen.';
const PUBLISHED = '2026-11-27';

const FAQ = [
  {
    question: 'Vad är ett publicerat besiktningspris?',
    answer:
      'Det är beloppet som stationens eller myndighetens egen sida anger för en namngiven kontroll och en fordonskategori. DriveLinkUp visar det beloppet och länkar till sidan.',
  },
  {
    question: 'Vad betyder från, fast pris och högsta pris?',
    answer:
      'Från är det lägsta belopp sidan publicerar. Fast pris är det belopp sidan anger för den kontrollen. Högsta pris är ett lagstadgat tak, inte det belopp varje verkstad tar.',
  },
  {
    question: 'Är efterkontroll samma pris som kontrollbesiktningen?',
    answer:
      'Nej. Efterkontroll är en egen rad när sidan publicerar ett eget belopp. Blanda inte ihop den med kontrollbesiktningen.',
  },
  {
    question: 'Varför saknas ett land?',
    answer:
      'Landet visas när stationens eller föreskriftens egen sida angav ett tal, en valuta och en fordonskategori. En sökträff eller en jämförelsesajt är inte en källa.',
  },
] as const;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['besiktning pris', 'kontrollbesiktning', 'besiktningspris', 'MOT', 'efterkontroll'],
  alternates: publicAlternates(path),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    url: absoluteUrl(path),
    publishedTime: PUBLISHED,
  },
};

export default function VadKostarBesiktningPage() {
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
          <p className="text-eyebrow">Besiktning · 27 november 2026</p>
          <h1 className="font-display text-h1 text-balance leading-tight tracking-tight">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Siffran är det belopp stationen eller föreskriften har publicerat för en namngiven
            kontroll. Ett frånpris är ett golv. Ett fast pris är det belopp sidan anger. Ett högsta
            pris är ett lagstadgat tak, inte det pris varje verkstad tar.
          </p>
        </header>
        <div className="grid gap-8 text-body text-foreground">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Läs etiketten före beloppet</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Från: sidans lägsta publicerade belopp för den kontrollen.</li>
              <li>
                Fast pris: beloppet sidan anger för just den kontrollen och den fordonskategorin.
              </li>
              <li>
                Högsta pris: taket i föreskriften. Verkstaden kan ta mindre. Den kan inte läsas som
                det pris du alltid betalar.
              </li>
            </ul>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Två belopp som lästes den 27 november 2026
            </h2>
            <p>
              Opus Bilprovning anger kontrollbesiktning av personbil från 699 kronor, inklusive
              moms, som sitt lägsta publicerade pris. I samma konsumenttabell står efterkontroll som
              399 kronor, utan ordet från. Sidan kallar beloppen sitt lägsta pris och skriver att de
              kan variera mellan station och tid. Det är två kontroller. Företagstabellen på samma
              adress är exklusive moms och är ett annat belopp. Källa:{' '}
              <a
                className="underline underline-offset-4"
                href="https://opus.se/priser/"
                rel="noopener noreferrer"
                target="_blank"
              >
                opus.se/priser
              </a>
              .
            </p>
            <p>
              GOV.UK anger högsta MOT-avgift för personbil till 54,85 pund. Beloppet är ett tak och
              anges utan moms. Källa:{' '}
              <a
                className="underline underline-offset-4"
                href="https://www.gov.uk/getting-an-mot/mot-test-fees"
                rel="noopener noreferrer"
                target="_blank"
              >
                gov.uk/getting-an-mot/mot-test-fees
              </a>
              .
            </p>
            <p>
              Ett belopp som inte gick att läsa om den dagen står kvar tills sidan kan läsas igen.
              Katalogen visar det senaste belopp som faktiskt publicerats, med datum när sidan
              lästes.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Varför ett land saknas</h2>
            <p>
              Ett land finns i katalogen när stationens eller föreskriftens egen sida angav ett tal,
              en valuta och en fordonskategori. En prisjämförelsesajt, en sökträff och en
              partnertext som säger att priset kan avvika är inte en källa. Saknas landet har ingen
              sådan sida lästs.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">DriveLinkUp bokar inte tiden</h2>
            <p>
              Kortet öppnar stationens eller myndighetens sida. Du bokar där, om den sidan erbjuder
              bokning. En listning är inte ett intyg om att stationen är verifierad.
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
              <Link href="/besiktning">Jämför besiktningspriser</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/blog/jamfor-bilpriser">Läs om bilpriser</Link>
            </Button>
          </div>
        </div>
      </article>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </main>
  );
}

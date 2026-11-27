import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/jamfor-parkeringspris';
const TITLE = 'Jämför parkeringspris i en stad';
const DESCRIPTION =
  'Jämför det publicerade timpriset för en namngiven plats i samma stad och samma valuta. Skylten på platsen avgör. DriveLinkUp reserverar inte platsen.';
const PUBLISHED = '2026-11-27';

const FAQ = [
  {
    question: 'Hur jämför jag parkeringspris i en stad?',
    answer:
      'Välj landet och staden. Jämför timpriset för namngivna platser i samma valuta. Ett pris från en annan stad eller en annan valuta är en annan jämförelse.',
  },
  {
    question: 'Gäller timpriset hela dygnet?',
    answer:
      'Bara om kortet säger det. En del taxor gäller dagtid, en del hela dygnet, och en del har en maxtid. Notisen på kortet kommer från operatörens sida.',
  },
  {
    question: 'Vem avgör vad jag betalar på plats?',
    answer:
      'Skylten vid platsen. Ett publicerat timpris är det belopp operatören angett för den namngivna platsen. Skylten på platsen kan ha ändrats efter att sidan lästes.',
  },
  {
    question: 'Reserverar DriveLinkUp platsen?',
    answer:
      'Nej. Kortet öppnar operatörens sida. DriveLinkUp tar inte betalt för parkeringen och kallar inte operatören verifierad.',
  },
] as const;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'parkeringspris',
    'parkeringsavgift',
    'timpris parkering',
    'Stockholm parkering',
    'jämför parkering',
  ],
  alternates: publicAlternates(path),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    url: absoluteUrl(path),
    publishedTime: PUBLISHED,
  },
};

export default function JamforParkeringsprisPage() {
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
          <p className="text-eyebrow">Parkering · 27 november 2026</p>
          <h1 className="font-display text-h1 text-balance leading-tight tracking-tight">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Jämför det publicerade timpriset för en namngiven plats, i samma stad och samma valuta.
            Skylten på platsen avgör vad du betalar. DriveLinkUp reserverar inte platsen.
          </p>
        </header>
        <div className="grid gap-8 text-body text-foreground">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Stockholm, läst den 27 november 2026
            </h2>
            <p>
              Stockholm Parkering anger de här timpriserna för besöksparkering. De gäller hela
              dygnet, de är förbetalda, och skylten på platsen gäller. Källa:{' '}
              <a
                className="underline underline-offset-4"
                href="https://www.stockholmparkering.se/"
                rel="noopener noreferrer"
                target="_blank"
              >
                stockholmparkering.se
              </a>
              .
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>Norra Djurgårdsstaden: 25 kronor per timme.</li>
              <li>Fåfängan, Södermalm: 30 kronor per timme.</li>
              <li>S:t Eriksplan, Vasastan: 60 kronor per timme.</li>
              <li>Norra Bantorget, Norrmalm: 95 kronor per timme.</li>
            </ul>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Andra städer där sidan angav ett timpris
            </h2>
            <p>
              Göteborg, Malmö, Oslo, Helsingfors och Köpenhamn finns när stadens eller operatörens
              egen sida angav ett timpris för en namngiven plats. Oslo-korten visar timpriset för
              bensin, diesel och hybrid. Elpriset är ett annat belopp och är inte kortets pris.
              Köpenhamn visar dagtaxan för 2026, klockan 08–18, inte tabellen för 2027.
            </p>
            <p>
              En stad saknas när dess sida inte angav ett tal, när sidan inte gick att läsa, eller
              när taxan är flera avgasklasser i stället för ett jämförbart timpris.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Så läser du kortet</h2>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Välj land och sedan stad. En stad i ett annat land ignoreras.</li>
              <li>Läs timpriset och notisen: hela dygnet, dagtid eller en maxtid.</li>
              <li>Jämför bara inom samma valuta.</li>
              <li>Öppna operatörens sida innan du kör dit. Skylten på platsen avgör.</li>
            </ol>
            <p>
              En plats som många öppnar kan flyttas upp inom samma valuta. Beloppet ändras inte av
              det. Beloppet ändras när operatörens sida läses om och visar ett nytt tal.
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
              <Link href="/parkering?country=SE&city=stockholm">
                Jämför parkeringspriser i Stockholm
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/parkering">Alla städer</Link>
            </Button>
          </div>
        </div>
      </article>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </main>
  );
}

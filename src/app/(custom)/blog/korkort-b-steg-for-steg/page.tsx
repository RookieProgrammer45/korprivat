import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/korkort-b-steg-for-steg';
const TITLE = 'Körkort B i Sverige: stegen från körkortstillstånd till uppkörning';
const DESCRIPTION =
  'Så tar du körkort B: körkortstillstånd, riskutbildning, kunskapsprov och körprov. Jämför trafikskolor och publicerade priser utan elevavgift.';
const PUBLISHED = '2026-10-26';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'körkort B',
    'körkortstillstånd',
    'riskutbildning',
    'kunskapsprov',
    'körprov',
    'uppkörning',
    'trafikskola',
    'körlektion',
    'övningskörning',
    'Transportstyrelsen',
    'Trafikverket',
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

export default function KorkortBStegForStegPage() {
  const url = absoluteUrl(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    inLanguage: 'sv-SE',
    keywords:
      'körkort B, körkortstillstånd, riskutbildning, kunskapsprov, körprov, trafikskola, körlektion, övningskörning',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Körkort B</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 26 oktober 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Börja med körkortstillstånd</h2>
            <p>
              Körkort B är personbilskortet de flesta söker. Innan du bokar körlektioner eller
              övningskörning behöver du ett körkortstillstånd från Transportstyrelsen. Tillståndet
              är ett godkännande att du får övningsköra, inte själva körkortet.
            </p>
            <p>
              Ansökan innehåller en hälsodeklaration. Synkrav och andra villkor kan gälla. Reglerna
              ändras, så läs den aktuella beskrivningen hos Transportstyrelsen innan du skickar in
              något. Ett tillstånd som inte är klart stoppar både trafikskola och privat
              övningskörning.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Riskutbildning innan körprovet</h2>
            <p>
              För körkort B ingår riskutbildning i två delar. Del 1 tar upp alkohol, droger och
              trötthet. Del 2 är den praktiska delen, ofta kallad halkbana. Båda ska vara klara
              innan du gör körprovet. Vilken ordning som passar dig beror på hur långt du har kommit
              med övningskörningen, och på vad den godkända utbildaren kräver.
            </p>
            <p>
              Boka riskutbildningen hos en aktör som har tillstånd för just den delen. DriveLinkUp
              är en katalog över trafikskolor, inte den myndighet som godkänner riskutbildare.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Kunskapsprov och teori</h2>
            <p>
              Kunskapsprovet, teoriprovet, bokas hos Trafikverket. Du läser trafikregler, vägmärken
              och säkerhet i din egen takt, ofta parallellt med körlektionerna. Ett godkänt prov
              gäller bara en begränsad tid. Kontrollera det aktuella fönstret hos Trafikverket så
              att teori och uppkörning inte glider isär.
            </p>
            <p>
              Det finns inget fast antal studietimmar. Det som räknas är att du kan reglerna när du
              sitter i provlokalen, inte hur många böcker du har köpt. Hur provet är uppbyggt och
              hur länge ett godkänt resultat gäller står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Övningskörning: trafikskola eller handledare
            </h2>
            <p>
              Du kan övningsköra på en trafikskola, privat med en godkänd handledare, eller
              kombinera båda. Det är två olika vägar. En skolannons är en trafikskola i katalogen.
              En handledare är en privat handledare för övningskörning, inte en skola och inte en
              bokningsbar lärare i katalogen.
            </p>
            <p>
              Privat övningskörning kräver att både elev och handledare uppfyller
              Transportstyrelsens villkor, inklusive introduktionsutbildning där den krävs. Läs{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/handledare-ovningskorning-sverige"
              >
                guiden om handledare och övningskörning
              </Link>{' '}
              och{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/trafikskola-eller-handledare"
              >
                när du ska välja trafikskola eller handledare
              </Link>
              .
            </p>
            <p>
              Antalet körlektioner varierar. Ingen seriös källa kan lova att ett visst timantal
              räcker. En trafikskola som publicerar pris per lektion gör det lättare att jämföra
              timpris, inte att förutse din totalkostnad. Se{' '}
              <Link className="underline underline-offset-4" href="/blog/kostnad-korkort-sverige">
                vad körkortet kan kosta
              </Link>{' '}
              och{' '}
              <Link className="underline underline-offset-4" href="/pricing">
                hur priset visas
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Körprov, uppkörningen</h2>
            <p>
              Körprovet bokas hos Trafikverket när körkortstillstånd, riskutbildning och
              kunskapsprov är på plats enligt de regler som gäller då. Provet bedömer hur du kör i
              trafik, inte hur många lektioner du har betalat. Efter ett godkänt prov utfärdar
              Transportstyrelsen körkortet.
            </p>
            <p>
              Provavgifter och väntetider publiceras av Trafikverket. De hör inte hemma som fasta
              siffror i en marknadsplatsannons, eftersom de kan ändras utan att skolan ändrar sitt
              lektionspris.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Jämför trafikskolor innan du bokar
            </h2>
            <p>
              När tillståndet är på gång kan du jämföra trafikskolor efter ort, körkortskategori,
              språk och publicerat pris. Det är gratis att titta. DriveLinkUp lägger inte på en
              elevavgift. Priset på annonsen är skolans publicerade pris. En annons är inte ett
              myndighetsgodkännande och inte ett löfte om en ledig tid.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Välj körkort B och den stad du faktiskt kan ta dig till.</li>
              <li>Jämför publicerat pris, språk och vad skolan skriver om upplägget.</li>
              <li>Kontakta skolan för tider, bil och avbokningsvillkor.</li>
            </ol>
            <p>
              Börja i{' '}
              <Link className="underline underline-offset-4" href="/locations/se/stockholm">
                Stockholm
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/se/goteborg">
                Göteborg
              </Link>{' '}
              eller{' '}
              <Link className="underline underline-offset-4" href="/locations/se/malmo">
                Malmö
              </Link>
              , eller öppna{' '}
              <Link className="underline underline-offset-4" href="/instructors">
                hela katalogen
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Checklista för körkort B</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Körkortstillstånd från Transportstyrelsen.</li>
              <li>Riskutbildning del 1 och del 2, klara innan körprovet.</li>
              <li>Kunskapsprov hos Trafikverket, inom giltighetstiden.</li>
              <li>Övningskörning på trafikskola, med handledare, eller båda.</li>
              <li>Körprov hos Trafikverket.</li>
              <li>Körkortet utfärdat av Transportstyrelsen.</li>
            </ul>
            <p>
              Juridiska detaljer och avgifter finns hos Transportstyrelsen och Trafikverket. Fler
              svar om katalogen finns i{' '}
              <Link className="underline underline-offset-4" href="/faq">
                vanliga frågor
              </Link>
              .
            </p>
          </section>
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
            <Button asChild>
              <Link href="/instructors">Jämför trafikskolor</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/blog">Fler guider</Link>
            </Button>
          </div>
        </div>
      </article>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </main>
  );
}

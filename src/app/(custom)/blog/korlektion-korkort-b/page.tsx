import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/korlektion-korkort-b';
const TITLE = 'Körlektion för körkort B: jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund';
const DESCRIPTION =
  'Körlektion för körkort B hos en trafikskola: körkortstillstånd, övningskörning och publicerat pris. Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund utan elevavgift.';
const PUBLISHED = '2026-11-09';

const TRANSPORTSTYRELSEN_OVNING =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/ovningskora/';
const TRANSPORTSTYRELSEN_B =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/';
const TRANSPORTSTYRELSEN_INTRO =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/';
const TRANSPORTSTYRELSEN_SKOLA =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/foretag/forarutbildning-och-kunskapsprov/tillstand/driva-trafikskola/';
const TRANSPORTSTYRELSEN_SOK =
  'https://www.transportstyrelsen.se/e-tjanster-inom-vagtrafik/?eservice=utbildareochprovanordnare-sok&tab=korkort';
const TRANSPORTSTYRELSEN_UTLAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/';
const TRANSPORTSTYRELSEN_EES =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/korkort-fran-lander-inom-ees/';
const TRANSPORTSTYRELSEN_UTANFOR =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/korkort-fran-lander-utanfor-ees/';
const TRAFIKVERKET_B = 'https://www.trafikverket.se/korkort/ta-korkort/personbil-och-latt-lastbil/';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'körlektion',
    'körkort B',
    'trafikskola',
    'körkortstillstånd',
    'övningskörning',
    'riskutbildning',
    'kunskapsprov',
    'körprov',
    'Stockholm',
    'Göteborg',
    'Malmö',
    'Lund',
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

export default function KorlektionKorkortBPage() {
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
      'körlektion, körkort B, trafikskola, körkortstillstånd, övningskörning, Stockholm, Göteborg, Malmö, Lund',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Körlektion</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 9 november 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion för körkort B hos en trafikskola
            </h2>
            <p>
              En körlektion är undervisning hos en trafikskola eller annan utbildare. Den är inte
              körkortet, inte kunskapsprovet och inte körprovet. Transportstyrelsen skriver att man
              kan övningsköra med trafikskola, utbildare eller privat. Ska du bara övningsköra hos
              en trafikskola eller utbildare räcker ett körkortstillstånd. Privat övningskörning
              kräver dessutom en godkänd handledare.
            </p>
            <p>
              Reglerna står på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_OVNING}>
                övningskörning
              </a>{' '}
              och på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_B}>
                behörighet B
              </a>
              . Hela kedjan från tillstånd till prov finns i{' '}
              <Link className="underline underline-offset-4" href="/blog/korkort-b-steg-for-steg">
                guiden om körkort B
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkortstillstånd innan första körlektionen
            </h2>
            <p>
              Innan en körlektion på väg för körkort B behöver du ett giltigt körkortstillstånd för
              grupp 1. Det är Transportstyrelsens beslut att du får övningsköra och göra
              körkortsprov. Ansökan, hälsodeklaration, synintyg och de fem årens giltighet står i{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/korkortstillstand-korkort-b"
              >
                guiden om körkortstillstånd
              </Link>
              .
            </p>
            <p>
              Åldern beror på fordonet. Personbil utan släp får du övningsköra från 16 år. Lätt
              lastbil och lätt släp kräver 17 år och 6 månader. Själva körkortet kan du få när du
              har fyllt 18 år, är permanent bosatt i Sverige eller har studerat här i minst sex
              månader, har en giltig riskutbildning och har godkänt kunskapsprov och körprov. Ta med
              en giltig id-handling. Transportstyrelsen räknar upp id-handling bland det som krävs
              för att övningsköra.
            </p>
            <p>
              Ansökan om körkortstillstånd kostar inget hos Transportstyrelsen. Avgifter för
              kunskapsprov och körprov publicerar Trafikverket. En körlektion har ett annat pris:
              det skolan själv har publicerat.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Tid, bil och publicerat pris på körlektionen
            </h2>
            <p>
              Varken Transportstyrelsen eller Trafikverket sätter ett antal körlektioner som du
              måste köpa för körkort B. Hur många lektioner som behövs är en fråga till skolan och
              till hur säker körningen är när du kommer till provet. Längden på lektionen är inte
              heller en nationell standard. Den står i skolans pris eller beskrivning.
            </p>
            <p>
              Fråga vilken bil lektionen körs i, och om den är manuell eller automatväxlad. Gör du
              körprovet i en bil med automatisk växellåda får körkortet villkorskod 78, och då får
              du bara köra automatväxlade bilar. Det står hos{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_B}>
                Trafikverket
              </a>{' '}
              och hos Transportstyrelsen. Skolan väljer inte villkoret. Provet gör det.
            </p>
            <p>
              Priset på annonsen är skolans publicerade pris. Det är gratis att jämföra, och
              DriveLinkUp lägger inte på en elevavgift. DriveLinkUp tar inte betalt för lektionen.
              Du kommer överens med skolan. En annons är inte ett löfte om en ledig tid.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Trafikskolans tillstånd är inte samma sak som annonsen
            </h2>
            <p>
              En trafikskola får drivas endast efter tillstånd av Transportstyrelsen. På skolan ska
              det finnas en trafikskolechef, utbildningsledare och godkända trafiklärare, och för
              varje elev som påbörjat utbildningen ska ett utbildningskort föras där teori och
              körlektioner redovisas. Avbryter du utbildningen ska du på begäran få en kopia av
              kortet. Kraven står på sidan om att{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_SKOLA}>
                driva trafikskola
              </a>
              .
            </p>
            <p>
              Du kan själv söka utbildare som har tillstånd och som har samtyckt till att synas i
              Transportstyrelsens{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_SOK}>
                e-tjänst för utbildare och provanordnare
              </a>
              . Listan är inte komplett för varje tillstånd, eftersom publicering kräver medgivande.
              En annons i DriveLinkUp är inte det registret och inte ett myndighetsgodkännande.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Övningskörning med handledare är en annan väg
            </h2>
            <p>
              En handledare är en privat person som Transportstyrelsen har godkänt för just dig.
              Handledaren är inte en trafikskola och inte en körlektion du kontaktar via en
              skolannons. Transportstyrelsen beskriver att privat övning och körning på trafikskola
              kan kombineras. Handledaren ska ha fyllt 24 år, ha giltigt körkort för fordonet och ha
              haft det i minst fem av de senaste tio åren.
            </p>
            <p>
              Från den 1 augusti 2026 krävs inte längre en introduktionsutbildning för elev eller
              handledare vid privat övningskörning för behörighet B. Tillståndet och det godkända
              handledarskapet finns kvar. Läs{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_INTRO}>
                Transportstyrelsens besked
              </a>
              ,{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/trafikskola-eller-handledare"
              >
                trafikskola eller handledare
              </Link>{' '}
              och{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/handledare-ovningskorning-sverige"
              >
                sidan om handledare
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Riskutbildning, kunskapsprov och körprov
            </h2>
            <p>
              Riskutbildning för personbil är inte en vanlig körlektion. Den har två delar,
              riskettan och halkbana, och båda ska vara giltiga när du gör kunskapsprov och körprov
              hos Trafikverket. Hur delarna fungerar står i{' '}
              <Link className="underline underline-offset-4" href="/blog/riskutbildning-korkort-b">
                guiden om riskutbildning
              </Link>
              .
            </p>
            <p>
              Kunskapsprovet och körprovet bokar du hos Trafikverket, inte i katalogen. Upplägget
              för teoriprovet står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>
              . Uppkörningen står i{' '}
              <Link className="underline underline-offset-4" href="/blog/korprov-korkort-b">
                guiden om körprovet
              </Link>
              . Om skolan lånar ut bil till provet är det skolans villkor. Det syns inte som ett
              löfte bara för att skolan har en annons.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion om du har kört i USA, Frankrike, Spanien, Norden, Australien eller
              Brasilien
            </h2>
            <p>
              Den här guiden gäller körkort B i Sverige. Bor du här och ska ta svenskt körkort är
              körlektionen densamma oavsett om du har lärt dig köra i USA, Frankrike, Spanien,
              övriga Europa, Norden, Australien eller Brasilien. Katalogen jämför också trafikskolor
              på andra orter. En annons i de länderna följer samma katalogregler: priset är skolans
              publicerade pris, det är gratis att jämföra, DriveLinkUp lägger inte på en elevavgift,
              och annonsen är inte ett myndighetsgodkännande. Körkortsreglerna i det landet står hos
              det landets myndighet, inte på annonsen och inte i den här texten.
            </p>
            <p>
              Har du redan ett körkort från Frankrike, Spanien eller ett annat EES-land, däribland
              Danmark, Norge, Finland och Island, skriver Transportstyrelsen att du inte tar ett
              nytt svenskt körkort B. Då är vägen ett utbyte, inte en ny omgång körlektioner och
              förarprov. Saknar du körkort och ska ta B i Sverige är körkortstillstånd grupp 1
              första steget, och en körlektion hos en svensk trafikskola kräver det tillståndet.
            </p>
            <p>
              Körkort från länder utanför EES byts i regel inte ut. Undantagen som
              Transportstyrelsen anger är Förenade kungariket, Färöarna, Schweiz och Japan. Ett
              körkort utanför EES slutar i regel gälla i Sverige ett år från den dag du blev
              folkbokförd här. Kort från Förenade kungariket och Färöarna kan fortfarande användas
              efter det året. Det träffar bland annat körkort från USA, Australien och Brasilien.
              När kortet inte längre gäller i Sverige är vägen till körkort B densamma som för den
              som tar kortet första gången. Villkoren står på sidorna om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_UTLAND}>
                utländska körkort
              </a>
              ,{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_EES}>
                körkort inom EES
              </a>{' '}
              och{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_UTANFOR}>
                länder utanför EES
              </a>
              . På engelska finns{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/swedish-drivers-license-expat-stockholm"
              >
                en guide för expats i Stockholm
              </Link>
              .
            </p>
            <p>
              Jämför lokala annonser i{' '}
              <Link className="underline underline-offset-4" href="/locations/us">
                USA
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/fr">
                Frankrike
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/es">
                Spanien
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/au">
                Australien
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/br">
                Brasilien
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/no">
                Norge
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/dk">
                Danmark
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/fi">
                Finland
              </Link>{' '}
              och{' '}
              <Link className="underline underline-offset-4" href="/locations/is">
                Island
              </Link>
              , eller öppna{' '}
              <Link className="underline underline-offset-4" href="/locations">
                alla orter
              </Link>
              . Hur ett publicerat pris ska läsas står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kostnad-korkort-sverige">
                guiden om kostnad
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund
            </h2>
            <p>
              Välj en stad du faktiskt kan ta dig till. Annonsens ort är skolans publicerade ort.
              Den är inte samma sak som den plats där Trafikverket håller kunskapsprov och körprov.
              Provtiden bokar du hos Trafikverket.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Skaffa körkortstillstånd grupp 1 innan första körlektionen på väg.</li>
              <li>Välj körkort B och en stad: Stockholm, Göteborg, Malmö eller Lund.</li>
              <li>Jämför publicerat pris, språk och hur skolan beskriver körlektionerna.</li>
              <li>
                Kontrollera tillståndet hos Transportstyrelsen om du vill veta att skolan får
                bedriva förarutbildning. Annonsen ersätter inte den kontrollen.
              </li>
              <li>Kontakta skolan. Fråga vad de behöver se innan första körlektionen.</li>
            </ol>
            <p>
              Börja i{' '}
              <Link className="underline underline-offset-4" href="/locations/se/stockholm">
                Stockholm
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/se/goteborg">
                Göteborg
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/se/malmo">
                Malmö
              </Link>{' '}
              eller{' '}
              <Link className="underline underline-offset-4" href="/locations/se/lund">
                Lund
              </Link>
              , eller öppna{' '}
              <Link className="underline underline-offset-4" href="/locations/se">
                hela Sverige
              </Link>
              . Hur priset visas förklaras på{' '}
              <Link className="underline underline-offset-4" href="/pricing">
                prissidan
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Checklista inför körlektionen</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Giltigt körkortstillstånd grupp 1 för körkort B.</li>
              <li>Rätt ålder för fordonet: personbil utan släp från 16 år.</li>
              <li>Giltig id-handling.</li>
              <li>
                Ingen egen handledare om du bara kör hos trafikskolan. Handledare hör till privat
                övningskörning.
              </li>
              <li>
                Priset du jämför är skolans publicerade pris. DriveLinkUp lägger inte på en
                elevavgift.
              </li>
              <li>
                Riskutbildning, kunskapsprov och körprov är egna steg. Proven bokas hos
                Trafikverket.
              </li>
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
              <Link href="/locations/se">Jämför trafikskolor</Link>
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

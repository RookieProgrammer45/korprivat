import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/kunskapsprov-korkort-b';
const TITLE = 'Kunskapsprov för körkort B: så fungerar teoriprovet hos Trafikverket';
const DESCRIPTION =
  'Kunskapsprov för körkort B: körkortstillstånd, riskutbildning, poäng och giltighet hos Trafikverket. Jämför trafikskolors publicerade priser utan elevavgift.';
const PUBLISHED = '2026-10-26';

const TRAFIKVERKET_B = 'https://www.trafikverket.se/korkort/ta-korkort/personbil-och-latt-lastbil/';
const TRAFIKVERKET_SPRAK =
  'https://www.trafikverket.se/korkort/ta-korkort/personbil-och-latt-lastbil/teoriprovet-pa-annat-sprak/';
const TRANSPORTSTYRELSEN_TILLSTAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/';
const TRANSPORTSTYRELSEN_RISK =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'kunskapsprov',
    'teoriprov',
    'körkort B',
    'körkortstillstånd',
    'riskutbildning',
    'körprov',
    'trafikskola',
    'körlektion',
    'övningskörning',
    'Trafikverket',
    'Transportstyrelsen',
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

export default function KunskapsprovKorkortBPage() {
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
      'kunskapsprov, teoriprov, körkort B, körkortstillstånd, riskutbildning, körprov, trafikskola, körlektion',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Kunskapsprov</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 26 oktober 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Kunskapsprov och teoriprov för körkort B
            </h2>
            <p>
              Kunskapsprovet är teoriprovet för körkort B. Du gör det hos Trafikverket, på en dator,
              efter att körkortstillstånd och riskutbildning är på plats. Ett godkänt prov är ett av
              stegen mot körkortet. Det ersätter varken körlektioner eller körprovet.
            </p>
            <p>
              DriveLinkUp bokar inte provet och tar inte emot provavgiften. Regler, tider och
              avgifter publiceras av{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_B}>
                Trafikverket
              </a>{' '}
              och{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_TILLSTAND}>
                Transportstyrelsen
              </a>
              . Hela vägen från tillstånd till uppkörning finns i{' '}
              <Link className="underline underline-offset-4" href="/blog/korkort-b-steg-for-steg">
                guiden om körkort B
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkortstillstånd innan du bokar kunskapsprovet
            </h2>
            <p>
              Trafikverket skriver att det inte går att boka prov utan körkortstillstånd. För
              personbil, behörighet B, söker du tillstånd i grupp 1 hos Transportstyrelsen. Ansökan
              innehåller en hälsodeklaration. Du behöver också ett grundläggande synintyg som inte
              är äldre än två månader vid ansökan. Många optiker kan skicka intyget digitalt.
            </p>
            <p>
              Transportstyrelsen tar inte betalt för själva ansökan. Synundersökningen hos optikern
              är ett separat ärende. Tillståndet gäller i fem år och kan inte förlängas.
              Handläggningen tar i normalfallet upp till fyra veckor när handlingarna är inne, och
              längre om ärendet behöver utredas. Hinner du inte bli klar med kunskapsprov och
              körprov inom de fem åren, ansöker du om ett nytt tillstånd. Läs det aktuella läget på
              Transportstyrelsens sida om körkortstillstånd innan du räknar med ett datum.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Riskutbildning ska vara gjord innan teoriprovet
            </h2>
            <p>
              Båda delarna av riskutbildningen för personbil ska vara genomförda och fortfarande
              giltiga när du kommer till kunskapsprovet. Del 1 tar upp alkohol, andra droger,
              trötthet och andra riskfyllda beteenden. Del 2 tar upp hastighet, säkerhet och körning
              vid olika väg- och väderförhållanden. Halkbana ingår i del 2.
            </p>
            <p>
              Del 2 ska påbörjas när du är i slutskedet av förarutbildningen. En riskutbildning för
              motorcykel gäller inte för personbil. Utbildningen gäller till den dag körkortet
              utfärdas, eller i högst fem år. Du gör den hos en utbildare som har tillstånd för just
              den delen. Trafikskolan anmäler sina elever. Övar du utan skola kontaktar du själv en
              godkänd utbildare. Listan finns hos{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_RISK}>
                Transportstyrelsen
              </a>
              . DriveLinkUp godkänner inte riskutbildare. En annons i katalogen är en trafikskola,
              inte ett myndighetsbeslut.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Så går kunskapsprovet till</h2>
            <p>
              Kom minst 30 minuter före start. Du fotograferas för körkortet innan provet och ska
              kunna visa en giltig id-handling. Saknar du id finns en särskild väg hos Trafikverket
              för att någon annan intygar identiteten. Den ansökan ska vara beviljad innan du
              kommer. Mobilen ska vara avstängd. Hörlurar, miniräknare och det du behöver i salen
              finns på plats.
            </p>
            <p>
              Provförrättaren kontrollerar legitimationen och visar en kort film. Provetiden börjar
              när du själv startar provet. Kunskapsprovet för körkort B har 70 frågor med
              svarsalternativ, och ett alternativ är rätt. Fem frågor är testfrågor och räknas inte.
              Högsta poäng är därför 65. Du blir godkänd på 52 poäng eller mer. Provtiden är 50
              minuter. Du kan lyssna på frågorna på svenska. Är du under 18 år när du bokar ska
              provet vara betalt senast 25 timmar före start. Beloppet står hos Trafikverket.
            </p>
            <p>
              När du bokar väljer du språk. Provet för behörighet B finns på 15 språk, däribland
              engelska, och du kan växla till svenska under provet. Behöver du tolk, förlängd
              provtid eller muntligt prov ansöker du hos Trafikverket innan bokningen. Den aktuella
              språklistan och stödformerna finns på{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_SPRAK}>
                Trafikverkets sida om teoriprov på annat språk
              </a>
              .
            </p>
            <p>
              Resultatet syns direkt på skärmen och i bokningstjänsten. Du får veta inom vilka
              områden du svarat fel, inte vilka enskilda frågor. Du kan göra ett prov per dag för
              samma behörighet. Övningsfrågor på nätet eller från en utbildare är inte samma frågor
              som på provet. Trafikverket mäter fem områden: fordonskännedom och manövrering, miljö,
              trafiksäkerhet, trafikregler och personliga förutsättningar.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Giltighetstid efter godkänt kunskapsprov
            </h2>
            <p>
              Transportstyrelsen har förlängt giltigheten för behörighet B. Ett kunskapsprov som
              godkänns från och med den 19 augusti 2026 gäller i ett år. Inom den tiden behöver du
              ett godkänt körprov. Hur uppkörningen går till står i{' '}
              <Link className="underline underline-offset-4" href="/blog/korprov-korkort-b">
                guiden om körprovet
              </Link>
              . Ett prov som godkändes före det datumet gällde i fyra månader. Datumet på ditt eget
              resultat styr, så kontrollera det i Trafikverkets bokningstjänst.
            </p>
            <p>
              Trafikverket rekommenderar att du bokar kunskapsprov och körprov vid samma tillfälle,
              med några veckor emellan. Då finns det tid att skriva om teorin om det behövs, innan
              körprovet. Provavgifter och lediga tider ändras hos Trafikverket. De hör inte hemma
              som fasta siffror på en skolannons.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion, trafikskola och övningskörning
            </h2>
            <p>
              Teorin sitter bättre om du varvar läsning med körning. En körlektion bokar du hos en
              trafikskola. Privat övningskörning gör du med en godkänd handledare. Det är två olika
              vägar. Handledare är en privat övningsväg, inte en trafikskola och inte en tid du
              bokar i katalogen.
            </p>
            <p>
              Antalet körlektioner varierar. Ingen kan lova att ett visst timantal räcker fram till
              kunskapsprovet eller körprovet. Det du kan jämföra är skolans publicerade pris per
              lektion. Läs{' '}
              <Link className="underline underline-offset-4" href="/blog/kostnad-korkort-sverige">
                vad körkortet kan kosta
              </Link>
              ,{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/trafikskola-eller-handledare"
              >
                när du väljer trafikskola eller handledare
              </Link>{' '}
              och{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/handledare-ovningskorning-sverige"
              >
                kraven för handledare och övningskörning
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Jämför trafikskolor i Stockholm, Göteborg och Malmö
            </h2>
            <p>
              När körkortstillståndet är på gång kan du jämföra trafikskolor efter ort, körkort B,
              språk och publicerat pris. Det är gratis att jämföra. DriveLinkUp lägger inte på en
              elevavgift. Priset på annonsen är skolans publicerade pris. En annons är inte ett
              myndighetsgodkännande och inte ett löfte om en ledig körlektion.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Välj körkort B och en stad du faktiskt kan ta dig till.</li>
              <li>Jämför publicerat pris, språk och hur skolan beskriver upplägget.</li>
              <li>
                Kontakta skolan om tider, bil och avbokning. Provtiden bokar du hos Trafikverket.
              </li>
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
              . Hur priset visas förklaras på{' '}
              <Link className="underline underline-offset-4" href="/pricing">
                prissidan
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Checklista inför kunskapsprovet</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Giltigt körkortstillstånd för grupp 1, från Transportstyrelsen.</li>
              <li>Riskutbildning del 1 och del 2, giltiga på provdagen.</li>
              <li>Bokning hos Trafikverket, med språk och betalning enligt deras regler.</li>
              <li>Giltig id-handling och tid att fotograferas, minst 30 minuter före start.</li>
              <li>70 frågor, 50 minuter, godkänt vid 52 poäng. Fem frågor räknas inte.</li>
              <li>
                Efter godkänt prov: körprov inom giltighetstiden. Ett år om provet är från den 19
                augusti 2026 eller senare.
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

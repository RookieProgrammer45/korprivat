import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/korkort-b-goteborg';
const TITLE = 'Körkort B i Göteborg: trafikskola, körlektion, kunskapsprov och körprov';
const DESCRIPTION =
  'Körkort B i Göteborg: körkortstillstånd, körlektion hos en trafikskola, riskutbildning, kunskapsprov och körprov. Jämför publicerat pris utan elevavgift.';
const PUBLISHED = '2026-11-11';

const TRANSPORTSTYRELSEN_B =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/';
const TRANSPORTSTYRELSEN_OVNING =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/ovningskora/';
const TRANSPORTSTYRELSEN_RISK =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/';
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
const TRAFIKVERKET_HISINGEN =
  'https://www.trafikverket.se/om-oss/kontakta-oss/vara-forarprovskontor/goteborg-hisingen-teoriprov-korprov-bil/';
const TRAFIKVERKET_HOGSBO =
  'https://www.trafikverket.se/om-oss/kontakta-oss/vara-forarprovskontor/goteborg-hogsbo-teoriprov-korprov-bil/';
const TRAFIKVERKET_PARTILLE =
  'https://www.trafikverket.se/om-oss/kontakta-oss/vara-forarprovskontor/goteborg-ost/';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'körkort B',
    'Göteborg',
    'trafikskola',
    'körlektion',
    'körkortstillstånd',
    'övningskörning',
    'riskutbildning',
    'kunskapsprov',
    'körprov',
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

export default function KorkortBGoteborgPage() {
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
      'körkort B, Göteborg, trafikskola, körlektion, körkortstillstånd, övningskörning, riskutbildning, kunskapsprov, körprov',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Göteborg</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 11 november 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkort B i Göteborg följer samma regler i hela Sverige
            </h2>
            <p>
              Med behörighet B får du köra personbil och lätt lastbil med en totalvikt på högst 3
              500 kg. Reglerna är nationella. De är desamma i Göteborg, på Hisingen, i Högsbo och i
              resten av landet. Transportstyrelsen skriver att du behöver ett giltigt
              körkortstillstånd, vara permanent bosatt i Sverige eller ha studerat här i minst sex
              månader, ha fyllt 18 år, ha en giltig riskutbildning för personbil, ha godkänt
              kunskapsprov och körprov, och inte ha ett körkort från ett annat EES-land.
            </p>
            <p>
              Kraven står på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_B}>
                behörighet B
              </a>
              . Hela kedjan, utan en särskild stad, finns i{' '}
              <Link className="underline underline-offset-4" href="/blog/korkort-b-steg-for-steg">
                guiden om körkort B
              </Link>
              . Den här texten säger var proven kan skrivas i Göteborg och hur du jämför en
              trafikskola i katalogen.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkortstillstånd innan övningskörning och körlektion
            </h2>
            <p>
              För att övningsköra för behörighet B ska du ha körkortstillstånd för grupp 1. Ska du
              bara övningsköra hos en trafikskola eller annan utbildare räcker tillståndet. Privat
              övningskörning kräver dessutom en godkänd handledare. Åldern beror på fordonet:
              personbil utan släp från 16 år, lätt lastbil och lätt släp från 17 år och 6 månader.
            </p>
            <p>
              Ansökan, hälsodeklaration, synintyg och de fem årens giltighet står i{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/korkortstillstand-korkort-b"
              >
                guiden om körkortstillstånd
              </Link>
              . Trafikverket skriver att det inte går att boka prov utan ett körkortstillstånd.
              Avgifter för proven publicerar Trafikverket. Priset på en körlektion är ett annat
              belopp: det skolan själv har publicerat.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion hos en trafikskola i Göteborg
            </h2>
            <p>
              En körlektion är undervisning hos en trafikskola eller annan utbildare. Varken
              Transportstyrelsen eller Trafikverket sätter ett antal körlektioner som du måste köpa
              för körkort B. Hur många lektioner som behövs, vilken bil skolan använder och vilka
              tider som finns är frågor till skolan.
            </p>
            <p>
              Annonsens ort är skolans publicerade ort. En skola som skriver Göteborg är inte samma
              sak som Trafikverkets förarprovskontor, och en annons är inte ett
              myndighetsgodkännande. Vill du se om en utbildare har tillstånd att bedriva
              förarutbildning använder du Transportstyrelsens uppgifter om att{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_SKOLA}>
                driva trafikskola
              </a>{' '}
              och e-tjänsten{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_SOK}>
                sök utbildare och provanordnare
              </a>
              . Vad som skiljer en körlektion från proven står i{' '}
              <Link className="underline underline-offset-4" href="/blog/korlektion-korkort-b">
                guiden om körlektion
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Handledare är privat övningskörning, inte en trafikskola
            </h2>
            <p>
              Handledare är en separat väg för privat övningskörning. Det är inte en skolannons och
              inte något du bokar som en körlektion. När ni övningskör privat ska handledaren ha med
              sig handledarbeviset, den grönvita skylten ÖVNINGSKÖR ska vara väl synlig bakifrån,
              och handledaren är ansvarig och räknas som förare. Det står på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_OVNING}>
                övningskörning
              </a>
              .
            </p>
            <p>
              Skillnaden mellan vägarna finns i{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/trafikskola-eller-handledare"
              >
                guiden om trafikskola eller handledare
              </Link>{' '}
              och på{' '}
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
              Riskutbildning innan kunskapsprov och körprov
            </h2>
            <p>
              Transportstyrelsen skriver att du måste göra en riskutbildning innan förarprovet,
              alltså både kunskapsprov och körprov, för behörighet B. Del 1 tar upp alkohol, andra
              droger, trötthet och andra riskfyllda beteenden. Del 2 tar upp hastighet, säkerhet och
              körning vid olika väg- och väderförhållanden, och halkbana ingår. Utbildningen gäller
              till den dag du tar körkortet eller i högst fem år. Trafikverket kräver dessutom att
              båda delarna är gjorda och giltiga när du kommer till kunskapsprovet. Vem som anmäler
              dig står i{' '}
              <Link className="underline underline-offset-4" href="/blog/riskutbildning-korkort-b">
                guiden om riskutbildning
              </Link>{' '}
              och på Transportstyrelsens sida om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_RISK}>
                riskutbildning för bil
              </a>
              . En körlektion hos en trafikskola i Göteborg ersätter inte riskutbildningen.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Kunskapsprov och körprov hos Trafikverket i Göteborg
            </h2>
            <p>
              Kunskapsprovet och körprovet bokar och betalar du hos Trafikverket, inte hos
              DriveLinkUp. Provet är detsamma oavsett kontor. På kunskapsprovet för behörighet B
              ingår 70 frågor, 52 poäng räcker för godkänt, provtiden är 50 minuter och högst 65
              poäng kan räknas eftersom 5 frågor är testfrågor. Du fotograferas före provet och ska
              komma minst 30 minuter innan, med en giltig id-handling. Är du under 18 år när du
              bokar ska provet vara betalt senast 25 timmar före start. Du kan bara göra ett prov
              per dag för samma behörighet. Körprovet börjar med en säkerhetskontroll och fortsätter
              i stadstrafik och på landsväg. Gör du körprovet i en automatväxlad bil får körkortet
              villkor 78, som begränsar behörigheten till automatväxlade bilar.
            </p>
            <p>
              Detaljerna står på Trafikverkets sida om{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_B}>
                personbil och lätt lastbil
              </a>
              , i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>{' '}
              och i{' '}
              <Link className="underline underline-offset-4" href="/blog/korprov-korkort-b">
                guiden om körprovet
              </Link>
              .
            </p>
            <p>
              Trafikverket publicerar tre kontor för teoriprov och körprov bil som hör till
              Göteborg. Öppettiderna på kontorssidorna gäller fotografering vid körkortsförnyelse.
              Prov kan pågå utanför de tiderna, och enstaka stängningar står på respektive sida.
              Boka tiden i Trafikverkets bokningstjänst och läs kontorets sida innan du åker.
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <a className="underline underline-offset-4" href={TRAFIKVERKET_HISINGEN}>
                  Göteborg Hisingen
                </a>
                , besöksadress Hildedalsgatan 2.
              </li>
              <li>
                <a className="underline underline-offset-4" href={TRAFIKVERKET_HOGSBO}>
                  Göteborg Högsbo
                </a>
                , besöksadress F O Petersons gata 24.
              </li>
              <li>
                <a className="underline underline-offset-4" href={TRAFIKVERKET_PARTILLE}>
                  Göteborg Partille
                </a>
                , besöksadress Göteborgsvägen 84, 433 63 Sävedalen. Kontoret ligger i Sävedalen,
                inte i Göteborgs innerstad.
              </li>
            </ul>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkort från USA, Frankrike, Spanien, Norden, Australien eller Brasilien
            </h2>
            <p>
              Bor du i Göteborg och ska ta körkort B i Sverige är utbildningen och proven desamma
              oavsett om du har lärt dig köra i USA, Frankrike, Spanien, övriga Europa, Norden,
              Australien eller Brasilien. Saknar du körkort är körkortstillstånd grupp 1 första
              steget.
            </p>
            <p>
              Har du redan körkort från Frankrike, Spanien eller ett annat EES-land, däribland
              Danmark, Norge, Finland och Island, tar du inte ett nytt svenskt körkort B.
              Transportstyrelsen skriver att vägen då är ett utbyte, om körkortet är giltigt och du
              är permanent bosatt i Sverige. Ett EES-körkort som från början kommer från ett land
              utanför EES har extra villkor. De står på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_EES}>
                körkort inom EES
              </a>
              .
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
              . Avgifter för utbyte och prov publicerar myndigheterna, inte den här guiden.
            </p>
            <p>
              DriveLinkUp är en katalog. Det är gratis att jämföra, och det finns ingen elevavgift.
              Priset på en annons är skolans publicerade pris. En annons är inte ett godkännande
              från Transportstyrelsen, Trafikverket eller från myndigheten i ett annat land.
              Körkortsreglerna i USA, Frankrike, Spanien, övriga Europa, Norden, Australien och
              Brasilien står hos det landets myndighet. I katalogen kan du öppna ortssidorna för{' '}
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
              , eller{' '}
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
            <h2 className="font-display text-h2 leading-tight">Jämför trafikskolor i Göteborg</h2>
            <p>
              Välj en skola du faktiskt kan ta dig till. Jämför körkort B, publicerat pris, språk
              och hur skolan beskriver körlektionerna. Kontakta skolan och fråga vad de behöver se
              innan första körlektionen. Provtiden bokar du hos Trafikverket när körkortstillstånd,
              riskutbildning och övriga villkor är uppfyllda.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Skaffa körkortstillstånd grupp 1 innan första körlektionen på väg.</li>
              <li>Öppna trafikskolor i Göteborg och filtrera på körkort B.</li>
              <li>Jämför skolans publicerade pris. DriveLinkUp lägger inte på en elevavgift.</li>
              <li>
                Kontrollera tillståndet hos Transportstyrelsen om du vill veta att skolan får
                bedriva förarutbildning.
              </li>
              <li>Kontakta skolan. Boka kunskapsprov och körprov hos Trafikverket.</li>
            </ol>
            <p>
              Börja med{' '}
              <Link className="underline underline-offset-4" href="/locations/se/goteborg">
                trafikskolor i Göteborg
              </Link>
              . Samma katalog har{' '}
              <Link className="underline underline-offset-4" href="/locations/se/stockholm">
                Stockholm
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/locations/se/malmo">
                Malmö
              </Link>{' '}
              och{' '}
              <Link className="underline underline-offset-4" href="/locations/se/lund">
                Lund
              </Link>
              ,{' '}
              <Link className="underline underline-offset-4" href="/western-northern-sweden">
                västra och norra Sverige
              </Link>{' '}
              och{' '}
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
            <h2 className="font-display text-h2 leading-tight">
              Checklista för körkort B i Göteborg
            </h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Giltigt körkortstillstånd grupp 1 innan övningskörning och innan provbokning.</li>
              <li>
                Rätt ålder för fordonet: personbil utan släp från 16 år, körkortet från 18 år.
              </li>
              <li>Körlektion hos en trafikskola kräver ingen egen handledare.</li>
              <li>
                Riskutbildningens båda delar ska vara giltiga på kunskapsprovet och körprovet.
              </li>
              <li>
                Kunskapsprov och körprov hos Trafikverket, till exempel Hisingen, Högsbo eller
                Partille i Sävedalen.
              </li>
              <li>Giltig id-handling och minst 30 minuter före kunskapsprovet.</li>
              <li>
                Priset du jämför är skolans publicerade pris. Det är gratis att jämföra, och
                DriveLinkUp lägger inte på en elevavgift.
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
              <Link href="/locations/se/goteborg">Jämför trafikskolor i Göteborg</Link>
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

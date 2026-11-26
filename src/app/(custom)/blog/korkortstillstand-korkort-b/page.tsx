import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/korkortstillstand-korkort-b';
const TITLE = 'Körkortstillstånd för körkort B: ansökan, synintyg och giltighet';
const DESCRIPTION =
  'Körkortstillstånd för körkort B: ansökan, synintyg och giltighet innan övningskörning, körlektion, kunskapsprov och körprov. Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund utan elevavgift.';
const PUBLISHED = '2026-11-04';

const TRANSPORTSTYRELSEN_TILLSTAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/';
const TRANSPORTSTYRELSEN_B =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/';
const TRANSPORTSTYRELSEN_OVNING =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/ovningskora/';
const TRANSPORTSTYRELSEN_INTRO =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/';
const TRANSPORTSTYRELSEN_SYN =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/trafikmedicin/synintyg/grundlaggande-synintyg/';
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
    'körkortstillstånd',
    'körkort B',
    'synintyg',
    'hälsodeklaration',
    'övningskörning',
    'körlektion',
    'trafikskola',
    'kunskapsprov',
    'körprov',
    'riskutbildning',
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

export default function KorkortstillstandKorkortBPage() {
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
      'körkortstillstånd, körkort B, synintyg, övningskörning, körlektion, trafikskola, kunskapsprov, körprov',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Körkortstillstånd</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 4 november 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkortstillstånd innan övningskörning och körkortsprov
            </h2>
            <p>
              Ett körkortstillstånd är Transportstyrelsens beslut att du får övningsköra och göra
              körkortsprov. Det är inte körkortet. För körkort B söker du tillstånd i grupp 1, samma
              grupp som traktor, AM, A1, A2, A och BE. Du behöver ett giltigt tillstånd både första
              gången du tar körkort och när du ska ta en ny behörighet, och i vissa fall efter en
              återkallelse.
            </p>
            <p>
              Utan tillstånd kan en trafikskola inte lägga en körlektion på väg, och du kan inte
              övningsköra privat. Provtiden hos Trafikverket förutsätter också att tillståndet
              gäller. Reglerna står på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_TILLSTAND}>
                körkortstillstånd
              </a>{' '}
              och på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_B}>
                behörighet B
              </a>
              . Hela kedjan efter tillståndet finns i{' '}
              <Link className="underline underline-offset-4" href="/blog/korkort-b-steg-for-steg">
                guiden om körkort B
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Ansökan, hälsodeklaration och synintyg
            </h2>
            <p>
              För grupp 1 skickar du in en hälsodeklaration och ett grundläggande synintyg.
              Hälsodeklarationen är frågor om din hälsa som du svarar på själv. I e-tjänsten fyller
              du i den direkt. Synintyget får inte vara utfärdat tidigare än två månader före
              ansökan. En legitimerad optiker eller läkare får utfärda det, och många optiker kan
              skicka intyget digitalt till Transportstyrelsen.
            </p>
            <p>
              Själva ansökan kostar inget hos Transportstyrelsen. Vad optikern tar för
              undersökningen är optikerns pris. Det är inte en avgift i DriveLinkUp och inte ett
              pris på en skolannons. Avgifter för kunskapsprov och körprov publicerar Trafikverket.
            </p>
            <p>
              E-tjänsten kräver e-legitimation. Ett begränsat Mobilt BankID för minderåriga fungerar
              inte där. Då beställer du en pappersblankett. Med blanketten för grupp 1 följer
              hälsodeklaration och synintyg. Den ifyllda ansökan skickas till Transportstyrelsen,
              701 97 Örebro. Vid synundersökningen behöver du styrka identiteten, till exempel med
              svenskt nationellt identitetskort, identitetskort från Skatteverket, svenskt körkort,
              EU-pass eller pass från Färöarna, Förenade kungariket, Island, Liechtenstein, Norge
              eller Schweiz. En nära anhörig med giltig id-handling kan också styrka vem du är.
              Godtagbara handlingar räknas upp hos Transportstyrelsen, med hänvisning till TSFS
              2021:62.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Handläggningstid och var tillståndet syns
            </h2>
            <p>
              Transportstyrelsen prövar personliga och medicinska krav. När kraven är uppfyllda och
              alla handlingar har kommit in tar det i normalfallet upp till fyra veckor. Ett ärende
              som behöver utredas tar längre tid. Utredningen kan innebära ett läkarintyg eller
              uppgifter från en annan myndighet, till exempel polisen. Myndigheten prioriterar inte
              enskilda ärenden och hanterar dem i den ordning de kom in.
            </p>
            <p>
              Har du en digital brevlåda skickas tillståndet dit. Du kan också se ansökan och om
              tillståndet gäller på Mina sidor. En trafikskola i katalogen ser inte det beslutet och
              kan inte utfärda det. En annons är inte ett körkortstillstånd.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Fem års giltighet, kopia och flera behörigheter
            </h2>
            <p>
              Tillståndet gäller i fem år och kan inte förlängas. Tar det slut innan du är klar
              ansöker du om ett nytt för att fortsätta övningsköra eller göra förarprov. Under
              giltighetstiden kan du ta de behörigheter som ingår i gruppen. Har du tagit AM på ett
              grupp 1-tillstånd och vill ta B medan samma tillstånd gäller, behöver du inte söka ett
              nytt.
            </p>
            <p>
              Har du tappat bort beviset, och tillståndet fortfarande gäller, beställer du en kopia
              i e-tjänsten. Det är inte en ny ansökan. Efter en återkallelse står det i beslutet om
              du behöver ett nytt tillstånd och ett nytt förarprov. Behöver du söka nytt tillstånd
              efter en spärrtid skriver Transportstyrelsen att du ska ansöka sex månader innan
              spärrtiden löper ut.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Ålder för ansökan, övningskörning och körkort B
            </h2>
            <p>
              Det finns ingen åldersgräns för att ansöka. Det finns åldersgränser för att
              övningsköra och för att få körkortet. För behörighet B får du övningsköra personbil
              utan släp från 16 år. Lätt lastbil och lätt släp kräver 17 år och 6 månader. Själva
              körkortet kan du få när du har fyllt 18 år.
            </p>
            <p>
              För att få körkort B krävs också att du är permanent bosatt i Sverige, eller har
              studerat här i minst sex månader, att riskutbildningen för personbil är giltig och att
              både kunskapsprov och körprov är godkända. Har du redan ett körkort från ett annat
              EES-land är vägen ett utbyte, inte ett nytt svenskt förarprov. Läs villkoren på sidan
              om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_B}>
                personbil och lätt lastbil
              </a>{' '}
              och hos{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_B}>
                Trafikverket
              </a>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion på trafikskola eller övningskörning med handledare
            </h2>
            <p>
              Ska du bara övningsköra hos en trafikskola räcker körkortstillståndet, tillsammans med
              ålderskravet och en giltig id-handling. En körlektion är undervisning hos skolan.
              Priset på annonsen är skolans publicerade pris. DriveLinkUp lägger inte på en
              elevavgift och tar inte betalt för lektionen.
            </p>
            <p>
              Privat övningskörning är en annan väg. Då behöver du även en handledare som
              Transportstyrelsen har godkänt för dig. Handledaren ska ha fyllt 24 år, ha giltigt
              körkort för fordonet och ha haft körkort i minst fem av de senaste tio åren.
              Handledaren har med sig handledarbeviset, den grönvita skylten ÖVNINGSKÖR ska synas
              bakifrån, och handledaren räknas som förare. Från den 1 augusti 2026 krävs inte längre
              en introduktionsutbildning för elev eller handledare vid privat övningskörning för
              behörighet B. Tillståndet och det godkända handledarskapet finns kvar. Läs
              Transportstyrelsens sidor om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_OVNING}>
                övningskörning
              </a>{' '}
              och om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_INTRO}>
                att introduktionsutbildningen har tagits bort
              </a>
              .
            </p>
            <p>
              En handledare är inte en trafikskola och inte en tid du bokar i katalogen. Jämför
              vägarna i{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/trafikskola-eller-handledare"
              >
                trafikskola eller handledare
              </Link>{' '}
              och läs{' '}
              <Link
                className="underline underline-offset-4"
                href="/blog/handledare-ovningskorning-sverige"
              >
                sidan om handledare
              </Link>
              . Hur ett publicerat lektionspris ska läsas står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kostnad-korkort-sverige">
                guiden om kostnad
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkort från Frankrike, Spanien, Norden, USA, Australien eller Brasilien
            </h2>
            <p>
              Katalogen jämför trafikskolor i Sverige. Den listar inte körskolor i USA, Frankrike,
              Spanien, Australien eller Brasilien, och en annons ersätter inget beslut från
              Transportstyrelsen. Bor du i Sverige och redan har körkort från ett annat land är det
              myndigheten som avgör om kortet gäller, om det kan bytas ut, eller om du ska ta
              svenskt förarprov. Körkortstillstånd behövs när du ska övningsköra och göra det
              provet.
            </p>
            <p>
              Frankrike, Spanien och övriga EES-länder, däribland Danmark, Norge, Finland och
              Island, följer reglerna för utbyte. Transportstyrelsen skriver att du inte tar ett
              nytt svenskt körkort B om du redan har ett körkort från ett annat EES-land. Då är
              vägen ett utbyte, inte en ansökan om körkortstillstånd för att göra om proven. Saknar
              du körkort och ska ta B i Sverige är körkortstillstånd grupp 1 första steget, oavsett
              vilket land du flyttat från.
            </p>
            <p>
              Körkort från länder utanför EES byts i regel inte ut. Undantagen som
              Transportstyrelsen anger är Förenade kungariket, Färöarna, Schweiz och Japan. Ett
              körkort utanför EES slutar i regel gälla i Sverige ett år från den dag du blev
              folkbokförd här. Kort från Förenade kungariket och Färöarna kan fortfarande användas
              efter det året. Det träffar bland annat körkort från USA, Australien och Brasilien: de
              byts inte ut, och när de inte längre gäller i Sverige är vägen till körkort B densamma
              som för den som tar kortet första gången, med körkortstillstånd, riskutbildning,
              kunskapsprov och körprov. Villkor och avgift för ett utbyte står på sidorna om{' '}
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
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Efter tillståndet: riskutbildning, kunskapsprov och körprov
            </h2>
            <p>
              När tillståndet gäller kan övningskörningen börja. Riskutbildning för personbil har
              två delar, riskettan och halkbana, och båda ska vara giltiga på kunskapsprovet och på
              körprovet. Del 2 hör hemma i slutskedet av utbildningen, inte samma dag som
              tillståndet kommer. Hur delarna fungerar står i{' '}
              <Link className="underline underline-offset-4" href="/blog/riskutbildning-korkort-b">
                guiden om riskutbildning
              </Link>
              .
            </p>
            <p>
              Kunskapsprovet och körprovet bokar du hos Trafikverket. Upplägget för teoriprovet står
              i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>
              . Uppkörningen står i{' '}
              <Link className="underline underline-offset-4" href="/blog/korprov-korkort-b">
                guiden om körprovet
              </Link>
              . Vad synintyget ska innehålla står hos Transportstyrelsen under{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_SYN}>
                grundläggande synintyg
              </a>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund
            </h2>
            <p>
              Medan ansökan handläggs kan du jämföra trafikskolor efter ort, körkort B, språk och
              publicerat pris. Det är gratis att jämföra. DriveLinkUp lägger inte på en elevavgift.
              Priset på annonsen är skolans publicerade pris. En annons är inte ett
              myndighetsgodkännande och inte ett löfte om att skolan har en ledig körlektion den dag
              tillståndet kommer.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>
                Ansök om körkortstillstånd grupp 1 och lämna synintyg som inte är för gammalt.
              </li>
              <li>Välj körkort B och en stad du faktiskt kan ta dig till.</li>
              <li>Jämför publicerat pris, språk och hur skolan beskriver körlektionerna.</li>
              <li>
                Fråga skolan vad de behöver se innan första körlektionen. Provtiden bokar du hos
                Trafikverket när riskutbildningen och de andra villkoren är uppfyllda.
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
            <h2 className="font-display text-h2 leading-tight">Checklista för körkortstillstånd</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Grupp 1 för körkort B, med hälsodeklaration och grundläggande synintyg.</li>
              <li>Synintyget är högst två månader gammalt när du ansöker.</li>
              <li>
                Ansökan hos Transportstyrelsen har ingen avgift. Provavgifter står hos Trafikverket.
              </li>
              <li>
                Räkna med upp till fyra veckor när ärendet är komplett. Utredning tar längre tid.
              </li>
              <li>Tillståndet gäller fem år och kan inte förlängas.</li>
              <li>Personbil utan släp från 16 år. Körkortet utfärdas från 18 år.</li>
              <li>
                Trafikskola kräver tillståndet. Privat övningskörning kräver också en godkänd
                handledare. Handledaren är inte en skolannons.
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

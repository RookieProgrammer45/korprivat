import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/korprov-korkort-b';
const TITLE = 'Körprov för körkort B: så går uppkörningen till hos Trafikverket';
const DESCRIPTION =
  'Körprov och uppkörning för körkort B: säkerhetskontroll, manövrer och körning i trafik. Körkortstillstånd, riskutbildning och kunskapsprov ska vara giltiga. Jämför trafikskolor utan elevavgift.';
const PUBLISHED = '2026-10-28';

const TRAFIKVERKET_KORPROV =
  'https://www.trafikverket.se/korkort/ta-korkort/personbil-och-latt-lastbil/sa-gar-korprovet-till/';
const TRAFIKVERKET_BOKA = 'https://www.trafikverket.se/korkort/boka-betala-och-avboka-prov/';
const TRAFIKVERKET_FORE = 'https://www.trafikverket.se/korkort/ta-korkort/fore-provet/';
const TRAFIKVERKET_RESULTAT =
  'https://www.trafikverket.se/om-oss/nyheter/trafikverkets-podcasts/klar-for-korkort/sammanfattande-texter-fran-podden-klar-for-korkort/';
const TRANSPORTSTYRELSEN_B =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/';
const TRANSPORTSTYRELSEN_TILLSTAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/';
const TRANSPORTSTYRELSEN_RISK =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/';
const TRANSPORTSTYRELSEN_GILTIGHET =
  'https://www.transportstyrelsen.se/sv/om-oss/pressrum/nyhetsarkiv/2026/korkortsprovet-giltigt-i-ett-ar/';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'körprov',
    'uppkörning',
    'körkort B',
    'körkortstillstånd',
    'riskutbildning',
    'kunskapsprov',
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

export default function KorprovKorkortBPage() {
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
      'körprov, uppkörning, körkort B, körkortstillstånd, riskutbildning, kunskapsprov, trafikskola, körlektion, övningskörning',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Körprov</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 28 oktober 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körprov och uppkörning för körkort B
            </h2>
            <p>
              Körprovet är uppkörningen för körkort B. Du gör det hos Trafikverket, i bil, när
              körkortstillstånd, riskutbildning och ett godkänt kunskapsprov är på plats. Provet
              visar att du kan köra i trafik. Det mäter inte hur många körlektioner du har betalat.
            </p>
            <p>
              DriveLinkUp bokar inte körprovet och tar inte emot provavgiften. Tider, regler och
              avgifter publiceras av{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_KORPROV}>
                Trafikverket
              </a>{' '}
              och{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_B}>
                Transportstyrelsen
              </a>
              . Hela vägen från tillstånd till prov finns i{' '}
              <Link className="underline underline-offset-4" href="/blog/korkort-b-steg-for-steg">
                guiden om körkort B
              </Link>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körkortstillstånd, riskutbildning och kunskapsprov innan körprovet
            </h2>
            <p>
              Trafikverket skriver att det inte går att boka prov utan körkortstillstånd. För
              personbil, behörighet B, söker du tillstånd i grupp 1 hos Transportstyrelsen. Ansökan
              innehåller en hälsodeklaration, och ett grundläggande synintyg får inte vara äldre än
              två månader när du ansöker. Tillståndet gäller i fem år. Läs det aktuella läget på{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_TILLSTAND}>
                Transportstyrelsens sida om körkortstillstånd
              </a>
              .
            </p>
            <p>
              För att få körkort med behörighet B ska du ha fyllt 18 år och vara permanent bosatt i
              Sverige, eller ha studerat här i minst sex månader. Har du redan ett körkort från ett
              annat EES-land är vägen ett utbyte, inte ett nytt förarprov. Villkoren står hos
              Transportstyrelsen.
            </p>
            <p>
              Båda delarna av riskutbildningen för personbil ska vara genomförda och fortfarande
              giltiga när du gör förarprovet. Del 1 tar upp alkohol, andra droger, trötthet och
              andra riskfyllda beteenden. Del 2 tar upp hastighet, säkerhet och körning vid olika
              väg- och väderförhållanden. Halkbana ingår i del 2, och den delen ska påbörjas när du
              är i slutskedet av förarutbildningen. En riskutbildning för motorcykel gäller inte för
              personbil. Utbildningen gäller till den dag körkortet utfärdas, eller i högst fem år.
            </p>
            <p>
              Du gör riskutbildningen hos en utbildare som har tillstånd för just den delen.
              Trafikskolan anmäler sina elever. Övar du utan skola kontaktar du själv en godkänd
              utbildare. Listan finns hos{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_RISK}>
                Transportstyrelsen
              </a>
              . DriveLinkUp godkänner inte riskutbildare. En annons i katalogen är en trafikskola,
              inte ett myndighetsbeslut.
            </p>
            <p>
              Körprovet får göras när kunskapsprovet är godkänt och fortfarande giltigt.
              Transportstyrelsen förlängde giltigheten för behörighet B den 19 augusti 2026. Ett
              kunskapsprov som godkänns från och med den dagen gäller i ett år. Ett prov som
              godkändes före det datumet gällde i fyra månader. Datumet på ditt eget resultat styr.
              Hur provet är uppbyggt står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>
              , och beslutet finns hos{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_GILTIGHET}>
                Transportstyrelsen
              </a>
              .
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Så går körprovet till hos Trafikverket
            </h2>
            <p>
              Förarprövaren möter dig och ni går till bilen. Du får veta hur provet går till och hur
              du dirigeras mellan mål. Tiden som är avsatt är 45 minuter. Du kör både i stadstrafik
              och i landsvägstrafik. Ibland sitter två förarprövare med, vid utbildning av nya
              förarprövare eller i Trafikverkets kvalitetsarbete.
            </p>
            <p>
              Körprovet består av säkerhetskontroll, särskild manövrering och körning i trafik.
              Nervositet är vanlig. Trafikverket ber dig säga till om du är stressad, och om det
              finns något förarprövaren behöver veta för att provet ska bli rättvist.
            </p>
            <p>
              När körningen är klar berättar förarprövaren om provet är godkänt. Trafikverket
              beskriver det i{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_RESULTAT}>
                sin genomgång av uppkörningen
              </a>
              . Resultatet finns också i bokningstjänsten. Efter ett godkänt körprov utfärdar
              Transportstyrelsen körkortet. Det är inte skolan och inte DriveLinkUp som utfärdar
              det.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Säkerhetskontroll, manövrer och körning i trafik
            </h2>
            <p>
              Provet börjar med en säkerhetskontroll. Förarprövaren säger vad du ska kontrollera.
              Det kan vara belysning, körriktningsvisare, reflexer och signal, vindrutetorkare och
              spolare, styrning, bromsar, däck och fälg, vätskor och varningssystem. Ser du en brist
              ska du kunna föreslå en åtgärd. En del du inte kan göra själv ber du förarprövaren om
              hjälp med. När du sätter dig ställer du in stol, huvudstöd, ratt, speglar och bälte.
            </p>
            <p>
              Under körningen kan du få visa effektiv bromsning, parkering, backning, start i
              lutning, vändning och start från vägkant. En effektiv bromsning betyder att du stannar
              på så kort sträcka som möjligt. Den görs i minst 50 km/h, och förarprövaren bestämmer
              hastigheten och säger när momentet är klart. Du kan också få använda bilens reglage,
              till exempel torkarna om det börjar regna.
            </p>
            <p>
              I trafiken tittar förarprövaren på hur du anpassar hastigheten, var du placerar bilen,
              och på din uppmärksamhet och riskmedvetenhet. Du kan få byta körfält, passera
              korsningar, trafikljus och cirkulationsplatser, köra om, möta trafik och köra
              självständigt mot ett mål. Kör du fel kan du vända och fortsätta mot målet. Motorväg
              eller motortrafikled kan ingå, där högsta tillåtna hastighet kan vara upp till 120
              km/h. Smal väg, vägarbete, järnvägskorsning, nedsatt sikt och halt väglag kan också
              ingå. Förarprövaren kan ställa en fråga som hör till en situation ni just kört igenom.
            </p>
            <p>
              Små fel som inte är avgörande för trafiksäkerheten, och som inte upprepas, kan ändå ge
              ett godkänt prov. Ett enstaka motorstopp som inte blir farligt kan lämna provet
              godkänt. Flera motorstopp betyder att manövreringen behöver mer övning. Att sakta ner
              för mycket eller ligga på för låg växel i en cirkulationsplats kan bli underkänt, som
              tecken på svag planering. Det är inte tillåtet att filma eller spela in ljud under
              körprovet.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Automatväxlad bil och villkor 78</h2>
            <p>
              Gör du körprovet i en automatväxlad bil får körkortet villkor 78. Då får du köra
              automatväxlade bilar. Vill du köra en manuellt växlad bil bokar du ett nytt körprov
              med manuell växel, och du tar ett nytt foto hos Trafikverket innan det provet.
              Tekniska hjälpmedel som redan finns i bilen, till exempel en backkamera, får användas.
              Kameran kompletterar uppsikten. Den ersätter den inte.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Provdagen: id-handling, foto och bil
            </h2>
            <p>
              Du ska visa en fysisk id-handling som är hel och som inte har gått ut. Trafikverket
              godtar bland annat svenskt nationellt id-kort, id-kort från Skatteverket, svenskt
              körkort och pass från EU, Norge, Island, Liechtenstein och Schweiz. BankID och Freja
              eID gäller inte. Ogiltig legitimation är den vanligaste orsaken till att du inte får
              göra körprovet. Då ska provavgiften ändå betalas. Saknar du id ansöker du hos
              Trafikverket om att någon annan intygar identiteten. Ansökan ska ha kommit in minst
              två veckor före provet och vara beviljad innan du kommer. Vilka handlingar som gäller
              står på{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_FORE}>
                sidan om vad som gäller före provet
              </a>
              .
            </p>
            <p>
              Fotot till körkortet tas hos Trafikverket, i samband med kunskapsprovet. Kom minst 30
              minuter före den provtiden. Ska du senare göra körprov för att ta bort villkor 78 tar
              du ett nytt foto innan det körprovet.
            </p>
            <p>
              Egen privat bil är inte tillåten på körprovet. Bilen ska komma från Trafikverket eller
              från en utbildare. Om en trafikskola ställer upp med bil är det en överenskommelse med
              skolan. Det syns inte som ett löfte på en katalogannons.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Boka körprov hos Trafikverket</h2>
            <p>
              Du bokar, betalar och ser resultat i Trafikverkets bokningstjänst. Trafikverket
              rekommenderar att du bokar kunskapsprov och körprov vid samma tillfälle, med några
              veckor emellan, så att det finns tid att skriva om teorin om det behövs. Avgifter och
              lediga tider ändras. Läs dem hos{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_BOKA}>
                Trafikverket
              </a>{' '}
              innan du räknar med ett belopp. De hör inte hemma som fasta siffror på en skolannons.
            </p>
            <p>
              Avbokar du senast 24 timmar före provtiden betalas provavgiften tillbaka. Avbokar du
              senare, eller kommer du inte, ska avgiften ändå betalas. Är du under 18 år när du
              bokar ska provet vara betalt senast 25 timmar före start, annars avbokas tiden.
              Automatiska bokningstjänster är inte tillåtna i Trafikverkets system.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Körlektion på trafikskola och övningskörning med handledare
            </h2>
            <p>
              Inför körprovet övar du på en trafikskola, privat med en godkänd handledare, eller
              både och. Det är två olika vägar. En körlektion bokar du hos skolan. Handledare är en
              privat övningsväg, inte en trafikskola och inte en tid du bokar i katalogen.
            </p>
            <p>
              Antalet körlektioner varierar. Ingen kan lova att ett visst timantal räcker fram till
              körprovet. Det du kan jämföra är skolans publicerade pris per lektion. Läs{' '}
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
              myndighetsgodkännande och inte ett löfte om en ledig körlektion eller om en bil till
              körprovet.
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
            <h2 className="font-display text-h2 leading-tight">Checklista inför körprovet</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Giltigt körkortstillstånd för grupp 1, från Transportstyrelsen.</li>
              <li>Du har fyllt 18 år när körkortet ska utfärdas.</li>
              <li>Riskutbildning del 1 och del 2, giltiga på provdagen.</li>
              <li>
                Godkänt kunskapsprov inom giltighetstiden. Ett år om provet är från den 19 augusti
                2026 eller senare.
              </li>
              <li>Bokning hos Trafikverket, betald enligt deras regler.</li>
              <li>Fysisk giltig id-handling. BankID räcker inte.</li>
              <li>Bil från Trafikverket eller från en utbildare, inte en egen privat bil.</li>
              <li>45 minuter avsatta: säkerhetskontroll, manövrer och körning i trafik.</li>
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

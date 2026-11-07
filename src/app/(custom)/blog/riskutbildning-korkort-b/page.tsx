import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { absoluteUrl, swedishCanonicalAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/riskutbildning-korkort-b';
const TITLE = 'Riskutbildning för körkort B: riskettan, halkbana och giltighet';
const DESCRIPTION =
  'Riskutbildning för körkort B: riskettan och halkbana innan kunskapsprov och körprov. Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund utan elevavgift.';
const PUBLISHED = '2026-11-02';

const TRANSPORTSTYRELSEN_RISK =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/';
const TRANSPORTSTYRELSEN_TILLSTAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/';
const TRANSPORTSTYRELSEN_UTLAND =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/';
const TRANSPORTSTYRELSEN_EES =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/korkort-fran-lander-inom-ees/';
const TRANSPORTSTYRELSEN_UTANFOR =
  'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/korkort-fran-lander-utanfor-ees/';
const TRAFIKVERKET_B = 'https://www.trafikverket.se/korkort/ta-korkort/personbil-och-latt-lastbil/';
const TSFS_RISK = 'https://www.transportstyrelsen.se/TSFS/TSFS%202012_40k.pdf';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'riskutbildning',
    'riskettan',
    'halkbana',
    'risktvåan',
    'körkort B',
    'körkortstillstånd',
    'kunskapsprov',
    'körprov',
    'trafikskola',
    'körlektion',
    'övningskörning',
    'Stockholm',
    'Göteborg',
    'Malmö',
    'Lund',
  ],
  alternates: swedishCanonicalAlternates(path),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    url: absoluteUrl(path),
    publishedTime: PUBLISHED,
  },
};

export default function RiskutbildningKorkortBPage() {
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
      'riskutbildning, riskettan, halkbana, körkort B, körkortstillstånd, kunskapsprov, körprov, trafikskola',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Guide · Riskutbildning</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">Av {siteName} · 2 november 2026</p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Riskutbildning, riskettan och halkbana för körkort B
            </h2>
            <p>
              Riskutbildning är obligatorisk för körkort B. Den har två delar. Del 1 kallas ofta
              riskettan och tar upp alkohol, andra droger, trötthet och andra riskfyllda beteenden.
              Del 2 tar upp hastighet, säkerhet och körning vid olika väg- och väderförhållanden.
              Halkbana ingår i del 2. Många kallar den delen risktvåan.
            </p>
            <p>
              Trafikverket kräver att båda delarna är genomförda och fortfarande giltiga när du
              kommer till kunskapsprovet. Samma krav gäller körprovet. DriveLinkUp bokar inte
              riskutbildningen och tar inte betalt för den. Reglerna finns hos{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_RISK}>
                Transportstyrelsen
              </a>{' '}
              och{' '}
              <a className="underline underline-offset-4" href={TRAFIKVERKET_B}>
                Trafikverket
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
              Körkortstillstånd, övningskörning och när halkbanan passar
            </h2>
            <p>
              Körkortstillstånd från Transportstyrelsen behövs innan du övningskör på väg och innan
              du kan boka förarprov. Ansökan innehåller en hälsodeklaration och ett synintyg.
              Transportstyrelsen tar inte betalt för själva ansökan. Tillståndet gäller i fem år och
              kan inte förlängas. Läs det aktuella läget på sidan om{' '}
              <a className="underline underline-offset-4" href={TRANSPORTSTYRELSEN_TILLSTAND}>
                körkortstillstånd
              </a>
              .
            </p>
            <p>
              Del 2 ska påbörjas när du är i slutskedet av förarutbildningen. Transportstyrelsen
              motiverar det med att delen ställer krav på körvana, bedömning och förståelse av
              trafiksituationer. Halkbanan är alltså inte det första du bokar samma dag som
              tillståndet kommer. Vilken del du gör först beror på hur långt du har kommit och på
              vad utbildaren med tillstånd kräver. Fråga den utbildaren vad de vill se innan del 2,
              eftersom den delen innehåller körning.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Riskettan: alkohol, droger och trötthet
            </h2>
            <p>
              Riskettan är en lektion om hur alkohol, andra droger, trötthet och andra beteenden
              påverkar körförmågan, och om hur de riskerna kan undvikas. Det är inte kunskapsprovet
              och inte ett poängsatt teoriprov hos Trafikverket. Utbildaren rapporterar till
              Transportstyrelsen att du har genomfört delen, efter en identitetskontroll.
            </p>
            <p>
              I föreskrifterna TSFS 2012:40 är undervisningstiden minst 180 minuter exklusive raster
              för varje del, med högst sexton elever per tillfälle. Lärare och elever ska vara
              närvarande samtidigt. Den tryckta föreskriften gäller om den konsoliderade PDF-filen
              skulle skilja sig. Läs{' '}
              <a className="underline underline-offset-4" href={TSFS_RISK}>
                TSFS 2012:40
              </a>{' '}
              om du vill se kursplanen.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Halkbana: riskutbildning del 2 för körkort B
            </h2>
            <p>
              Del 2 sker på en trafikövningsplats, den anläggning som i vardagligt tal kallas
              halkbana. Syftet är att du ska märka hur hastighet och väglag hänger ihop med
              olycksrisk, och att du ska värdera din egen körförmåga. Vid de praktiska momenten får
              det vara högst fyra elever per lärare. Fordonen på anläggningen tillhandahålls för
              utbildningen.
            </p>
            <p>
              En riskutbildning för motorcykel gäller inte för personbil, och tvärtom. Du gör varje
              del hos en utbildare som har tillstånd för just den delen. En annons i DriveLinkUp är
              en trafikskola i katalogen, inte ett beslut från Transportstyrelsen om att skolan får
              hålla riskutbildning.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Giltighet innan kunskapsprov och körprov
            </h2>
            <p>
              Riskutbildningen gäller till den dag körkortet utfärdas, eller i högst fem år. Båda
              delarna ska fortfarande vara giltiga på kunskapsprovet och på körprovet. Hur
              teoriprovet är uppbyggt står i{' '}
              <Link className="underline underline-offset-4" href="/blog/kunskapsprov-korkort-b">
                guiden om kunskapsprovet
              </Link>
              . Hur uppkörningen går till står i{' '}
              <Link className="underline underline-offset-4" href="/blog/korprov-korkort-b">
                guiden om körprovet
              </Link>
              .
            </p>
            <p>
              Har ett körkort återkallats krävs en ny riskutbildning innan förarprovet. Prövotid och
              andra återkallelsefall har egna regler. Läs dem hos Transportstyrelsen innan du bokar
              om samma intyg. Provavgiften för kunskapsprov och körprov publiceras av Trafikverket,
              inte som ett fast belopp på en skolannons.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              Trafikskola, körlektion och handledare
            </h2>
            <p>
              Går du på en trafikskola anmäler skolan dig till riskutbildningen. Utbildar du dig
              privat kontaktar du själv en utbildare med tillstånd. Den som håller utbildningen
              rapporterar att den är genomförd. Listan över utbildare finns hos Transportstyrelsen.
              Priset sätter utbildaren. DriveLinkUp lägger inte på en elevavgift och publicerar
              inget eget pris för riskettan eller halkbana.
            </p>
            <p>
              En körlektion är undervisning hos en trafikskola. Övningskörning med handledare är en
              separat privat väg: handledaren är inte en trafikskola och inte en tid du bokar i
              katalogen. Handledare blir inte riskutbildare för att eleven övningskör privat. Jämför
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
                kraven för handledare
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
              Katalogen jämför trafikskolor i Sverige. Bor du här och redan har körkort från ett
              annat land är det Transportstyrelsen som avgör om kortet gäller, om det kan bytas ut,
              eller om du ska ta svenskt förarprov. Riskutbildning för behörighet B krävs när du ska
              göra det provet. Ett utbyte är inte samma sak, och en annons ersätter inget
              myndighetsbeslut.
            </p>
            <p>
              Frankrike, Spanien och övriga EES-länder, däribland Danmark, Norge, Finland och
              Island, har egna regler för giltighet och utbyte. Länder utanför EES följer en annan
              ordning. Transportstyrelsen skriver att körkort från andra länder utanför EES än
              Förenade kungariket, Färöarna, Schweiz och Japan inte byts ut mot ett svenskt, och att
              ett körkort utanför EES i regel slutar gälla i Sverige när du har varit folkbokförd
              här i mer än ett år. Det träffar bland annat körkort från USA, Australien och
              Brasilien. Undantagen och villkoren står på sidorna om{' '}
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
              . Avgifter för ett utbyte står på Transportstyrelsens inbetalningskort, inte här.
            </p>
            <p>
              Ska du ändå ta körkort B i Sverige är riskettan, halkbanan, kunskapsprovet och
              körprovet samma steg oavsett var du har kört tidigare. På engelska finns{' '}
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
              Jämför trafikskolor i Stockholm, Göteborg, Malmö och Lund
            </h2>
            <p>
              När körkortstillståndet är på gång kan du jämföra trafikskolor efter ort, körkort B,
              språk och publicerat pris. Det är gratis att jämföra. DriveLinkUp lägger inte på en
              elevavgift. Priset på annonsen är skolans publicerade pris. En annons är inte ett
              myndighetsgodkännande och inte ett löfte om en ledig körlektion eller om en plats på
              halkbanan.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Välj körkort B och en stad du faktiskt kan ta dig till.</li>
              <li>Jämför publicerat pris, språk och hur skolan beskriver körlektionerna.</li>
              <li>
                Fråga skolan om de anmäler dig till riskettan och halkbana, eller om du bokar
                delarna själv hos en utbildare med tillstånd. Provtiden bokar du hos Trafikverket.
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
            <h2 className="font-display text-h2 leading-tight">Checklista för riskutbildning</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Körkortstillstånd innan övningskörning på väg och innan du bokar prov.</li>
              <li>Riskettan, del 1, hos en utbildare med tillstånd för den delen.</li>
              <li>Halkbana, del 2, i slutskedet av förarutbildningen.</li>
              <li>
                Båda delarna giltiga på kunskapsprovet och på körprovet. De gäller högst fem år, och
                inte efter att körkortet har utfärdats.
              </li>
              <li>Motorcykelns riskutbildning räknas inte för personbil.</li>
              <li>Ta med identitetshandling. Utbildaren rapporterar genomförd del.</li>
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

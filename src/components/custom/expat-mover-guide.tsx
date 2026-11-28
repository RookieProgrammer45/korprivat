import Link from 'next/link';

const EU_LICENCE =
  'https://europa.eu/youreurope/citizens/vehicles/driving-licence/get-driving-licence/index_en.htm';
const UK_EXCHANGE = 'https://www.gov.uk/exchange-foreign-driving-licence';
const NSW_LEARNER =
  'https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/driver-licences/learner-driver-licence';
const USA_DMV = 'https://www.usa.gov/motor-vehicle-services';

/**
 * The same sourced note on every guide: the licence is issued where you live,
 * and a catalogue row exists only when a publisher stated the amount.
 */
export function ExpatMoverGuide({ lang }: { lang: 'sv' | 'en' }) {
  if (lang === 'en') {
    return (
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 text-body text-foreground">
        <h2 className="font-display text-h3 leading-tight">If you are moving</h2>
        <p>
          These guides are for someone getting a driving licence, owning a car, or working with a
          car, after a move to Europe, the United Kingdom, the United States, South America or
          Australia. The licence is issued where you live. A price on DriveLinkUp is an amount that
          publisher wrote on its own page.
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            In the EU,{' '}
            <a className="underline underline-offset-4" href={EU_LICENCE}>
              Your Europe
            </a>{' '}
            says you apply in the country where you usually live, as a rule for at least 185 days in
            a calendar year. Category B is generally from 18. You meet the medical rules and pass a
            theory test and a driving test. The EU does not set the rules for driving schools.
          </li>
          <li>
            In Great Britain,{' '}
            <a className="underline underline-offset-4" href={UK_EXCHANGE}>
              GOV.UK
            </a>{' '}
            has a tool for exchanging a non-GB licence. That page covers England, Wales and
            Scotland. Northern Ireland uses a different process.
          </li>
          <li>
            In Australia, each state and territory issues the licence. New South Wales says a
            learner licence is from 16, after proof of identity, an eyesight test and the Driver
            Knowledge Test. A supervisor with a full Australian licence sits beside you. Under 25,
            the log is at least 120 hours, including 20 at night, before a P1 licence. The learner
            licence lasts five years. Those are{' '}
            <a className="underline underline-offset-4" href={NSW_LEARNER}>
              New South Wales rules
            </a>
            , not a single national rule.
          </li>
          <li>
            In the United States,{' '}
            <a className="underline underline-offset-4" href={USA_DMV}>
              USA.gov
            </a>{' '}
            sends you to the motor-vehicle office of the state or territory where you live for the
            licence and for registering the car.
          </li>
        </ul>
        <p>
          Australia is its own continent in the catalogue: New South Wales, Victoria, Queensland,
          Western Australia, South Australia, Tasmania, the Australian Capital Territory and the
          Northern Territory. An Australian driving school shows a lesson price only when that
          school&apos;s page stated an amount in Australian dollars. Open{' '}
          <Link className="underline underline-offset-4" href="/locations/au">
            Australia
          </Link>
          . South America in the location catalogue is Brazil. A missing country means that
          publisher page was not read, not that the country has no licence.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-5 text-body text-foreground">
      <h2 className="font-display text-h3 leading-tight">Om du flyttar</h2>
      <p>
        Guiderna är skrivna för den som ska ta körkort, äga en bil eller arbeta med en bil efter en
        flytt till Europa, Storbritannien, USA, Sydamerika eller Australien. Körkortet utfärdas där
        du bor. Ett pris på DriveLinkUp är beloppet utgivaren skrev på sin egen sida.
      </p>
      <ul className="ml-6 list-disc space-y-2">
        <li>
          I EU säger{' '}
          <a className="underline underline-offset-4" href={EU_LICENCE}>
            Your Europe
          </a>{' '}
          att du ansöker i det land där du vanligen bor, i regel minst 185 dagar under ett
          kalenderår. Kategori B är i regel från 18 år. Du ska uppfylla de medicinska kraven och
          klara ett kunskapsprov och ett körprov. EU sätter inte reglerna för trafikskolor.
        </li>
        <li>
          I Storbritannien har{' '}
          <a className="underline underline-offset-4" href={UK_EXCHANGE}>
            GOV.UK
          </a>{' '}
          ett verktyg för att byta ett körkort som inte är brittiskt. Sidan gäller England, Wales
          och Skottland. Nordirland har en annan process.
        </li>
        <li>
          I Australien utfärdar varje delstat och territorium körkortet. New South Wales skriver att
          learner licence gäller från 16 år, efter identitet, syntest och Driver Knowledge Test. En
          handledare med ett fullt australiskt körkort sitter bredvid. Under 25 år ska loggboken ha
          minst 120 timmar, varav 20 på natten, före P1. Learner-kortet gäller i fem år. Det är{' '}
          <a className="underline underline-offset-4" href={NSW_LEARNER}>
            New South Wales regler
          </a>
          , inte en gemensam australisk lag.
        </li>
        <li>
          I USA skickar{' '}
          <a className="underline underline-offset-4" href={USA_DMV}>
            USA.gov
          </a>{' '}
          dig till motorfordonsmyndigheten i den delstat eller det territorium där du bor, både för
          körkortet och för att registrera bilen.
        </li>
      </ul>
      <p>
        Australien är en egen kontinent i katalogen: New South Wales, Victoria, Queensland, Western
        Australia, South Australia, Tasmanien, Australian Capital Territory och Northern Territory.
        En australisk trafikskola visar lektionspris bara när skolans sida angav ett belopp i
        australiska dollar. Öppna{' '}
        <Link className="underline underline-offset-4" href="/locations/au">
          Australien
        </Link>
        . Sydamerika i platskatalogen är Brasilien. Ett land som saknas betyder att utgivarens sida
        inte lästes, inte att landet saknar körkort.
      </p>
    </section>
  );
}

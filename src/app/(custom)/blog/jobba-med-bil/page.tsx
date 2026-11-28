import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpatMoverGuide } from '@/components/custom/expat-mover-guide';
import { absoluteUrl, swedishCanonicalAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/jobba-med-bil';
const TITLE = 'Arbeta med bil efter en flytt: körkort, taxi och verkstad';
const DESCRIPTION =
  'Ett vanligt körkort är inte ett tillstånd att köra taxi. En kurs eller ett provpris visas bara när skolan eller myndigheten publicerade beloppet. DriveLinkUp anmäler dig inte.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: swedishCanonicalAlternates(path),
};

export default function JobbaMedBilPage() {
  const url = absoluteUrl(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: '2026-11-28',
    dateModified: '2026-11-28',
    inLanguage: 'sv-SE',
    author: { '@type': 'Organization', name: siteName, url: absoluteUrl('/') },
    mainEntityOfPage: url,
  };

  return (
    <article className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <p className="text-eyebrow text-muted-foreground">Arbeta med bil</p>
      <h1 className="font-display text-balance text-4xl font-semibold tracking-tight">{TITLE}</h1>
      <p className="text-lg text-muted-foreground">
        Ett personbilskort räcker för att köra den egna bilen där det kortet gäller. Det är inte ett
        tillstånd att köra taxi, och det är inte en beställning av reservdelar.
      </p>
      <ExpatMoverGuide lang="sv" />
      <div className="grid gap-4 text-body text-foreground">
        <p>
          Taxiförarutbildning är en egen kurs, skild från körprovet för personbil. Katalogen visar
          ett kurspris eller en officiell provavgift bara när skolan eller myndigheten skrev
          beloppet på sin sida. Idag finns sådana rader för Sverige och Storbritannien. DriveLinkUp
          anmäler dig inte och kallar inte skolan verifierad. Jämför på{' '}
          <Link className="underline underline-offset-4" href="/taxiutbildning">
            taxiförarutbildning
          </Link>
          .
        </p>
        <p>
          Den som arbetar i en verkstad jämför reservdelar på samma sätt. Priset är det butiken
          publicerade. Öppna{' '}
          <Link className="underline underline-offset-4" href="/reservdelar?buyer=workshop">
            reservdelar för verkstad
          </Link>
          .
        </p>
      </div>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </article>
  );
}

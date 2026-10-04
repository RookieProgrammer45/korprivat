import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/kostnad-korkort-sverige';

export const metadata: Metadata = {
  title: 'Vad kostar körkortet i Sverige? — DriveLinkUp',
  description:
    'Översikt av lektionspriser, skolavgifter och hur DriveLinkUp visar publicerade priser utan separat elevavgift.',
  alternates: publicAlternates(path),
};

export default function KostnadKorkortPage() {
  const url = absoluteUrl(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Vad kostar körkortet i Sverige?',
    description:
      'Hur lektionspriser och skolavgifter hänger ihop, och hur du jämför auktoriserade trafikskolor.',
    author: { '@type': 'Organization', name: siteName },
    mainEntityOfPage: url,
    inLanguage: 'sv-SE',
  };

  return (
    <article className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <p className="text-eyebrow text-muted-foreground">Guide</p>
      <h1 className="font-display text-balance text-4xl font-semibold tracking-tight">
        Vad kostar körkortet i Sverige?
      </h1>
      <p className="text-lg text-muted-foreground">
        Totalkostnaden varierar med antal lektioner, teori och prov. Det du kan jämföra tidigt är
        skolans publicerade lektionspris — och om någon lägger på dolda marknadsplatsavgifter.
      </p>
      <div className="grid gap-4 text-body text-foreground">
        <p>
          På DriveLinkUp betalar elever ingen separat plattformsavgift. Du ser skolans pris i SEK per
          timme, bokar en ledig tid och betalar det publicerade beloppet till escrow.
        </p>
        <p>
          Skolans provision till DriveLinkUp (8% för skolbokningar, 10% för oberoende instruktörer)
          tas efter genomförd tjänst och påverkar inte elevens checkout-total.
        </p>
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
          <Link className="underline underline-offset-4" href="/instructors">
            hela katalogen
          </Link>
          . Läs mer om{' '}
          <Link className="underline underline-offset-4" href="/pricing">
            prissättning
          </Link>
          .
        </p>
      </div>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </article>
  );
}

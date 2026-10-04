import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { siteName } from '@/lib/site';

const path = '/blog/trafikskola-eller-handledare';

export const metadata: Metadata = {
  title: 'Trafikskola eller handledare? — DriveLinkUp',
  description:
    'Skillnaden mellan auktoriserad trafikskola och privat handledare för övningskörning i Sverige — och hur DriveLinkUp håller vägarna isär.',
  alternates: publicAlternates(path),
};

export default function TrafikskolaEllerHandledarePage() {
  const url = absoluteUrl(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Trafikskola eller handledare?',
    description:
      'När du ska boka lektioner hos en trafikskola och när privat övningskörning med handledare gäller.',
    author: { '@type': 'Organization', name: siteName },
    mainEntityOfPage: url,
    inLanguage: 'sv-SE',
  };

  return (
    <article className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <p className="text-eyebrow text-muted-foreground">Guide</p>
      <h1 className="font-display text-balance text-4xl font-semibold tracking-tight">
        Trafikskola eller handledare?
      </h1>
      <p className="text-lg text-muted-foreground">
        Det är två olika produkter. Trafikskolor ger strukturerade lektioner. Handledare möjliggör
        privat övningskörning under Trafikverket-orienterade regler.
      </p>
      <div className="grid gap-4 text-body text-foreground">
        <p>
          <strong>Trafikskola:</strong> boka verifierade annonser i katalogen, betala publicerat
          pris, få lektion med auktoriserad verksamhet. Det är marknadsplatsens huvudsakliga
          bokningsflöde.
        </p>
        <p>
          <strong>Handledare:</strong> för privat övningskörning — särskilt relevant för 16–17-åringar
          som behöver godkänt handledarskap innan de kan boka på DriveLinkUp. Det är inte samma sak
          som en skolannons.
        </p>
        <p>
          Läs den juridiska översikten på{' '}
          <Link className="underline underline-offset-4" href="/handledare">
            /handledare
          </Link>{' '}
          och den längre guiden{' '}
          <Link
            className="underline underline-offset-4"
            href="/blog/handledare-ovningskorning-sverige"
          >
            Handledare och övningskörning
          </Link>
          . När du är redo för skollektioner, börja i{' '}
          <Link className="underline underline-offset-4" href="/instructors">
            katalogen
          </Link>
          .
        </p>
      </div>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </article>
  );
}

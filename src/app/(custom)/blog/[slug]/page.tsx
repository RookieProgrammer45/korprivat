import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import content from '../../../../../messages/europe-driving-guides.en.json';
import { siteName, siteUrl } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };
const findGuide = (slug: string) => content.guides.find((guide) => guide.slug === slug);
const guidePath = (slug: string) => `/en/blog/${slug}`;

export function generateStaticParams() {
  return content.guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const canonical = `${siteUrl}${guidePath(guide.slug)}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical, languages: { en: canonical } },
    openGraph: { type: 'article', title: guide.title, description: guide.description, url: canonical, locale: 'en_GB' },
  };
}

export default async function EuropeanLicenceGuide({ params }: Props) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en',
    author: { '@type': 'Organization', name: siteName, url: siteUrl },
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
    mainEntityOfPage: `${siteUrl}${guidePath(guide.slug)}`,
    citation: [...new Set(guide.sections.flatMap((section) => section.sources.map((source) => source.url)))],
  };
  return (
    <main lang="en" className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <Link href="/en/blog" className="text-small underline underline-offset-4">{content.ui.back}</Link>
          <h1 className="font-display text-h1 leading-tight tracking-tight">{guide.title}</h1>
          <p className="text-body-lg text-muted-foreground">{guide.description}</p>
          <p className="text-small text-muted-foreground">{content.ui.byline} · {content.ui.reviewed} <time dateTime={content.reviewed}>{content.reviewed}</time></p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          {guide.sections.map((section) => (
            <section key={section.title} className="grid gap-3">
              <h2 className="font-display text-h2 leading-tight">{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <div className="grid gap-2 text-small">
                <p className="text-muted-foreground">{content.ui.sources}</p>
                <ul className="ml-5 list-disc space-y-2">
                  {section.sources.map((source) => <li key={source.url}><a href={source.url} className="break-words underline underline-offset-4">{source.label}</a></li>)}
                </ul>
              </div>
            </section>
          ))}
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">{content.ui.compareTitle}</h2>
            <ul className="ml-5 list-disc space-y-2">{content.ui.compare.map((question) => <li key={question}>{question}</li>)}</ul>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">{content.ui.existingTitle}</h2>
            <p>{content.ui.existing}</p>
          </section>
          <nav aria-labelledby="related-guides-heading" className="grid gap-3 border-t border-border pt-6">
            <h2 id="related-guides-heading" className="font-display text-h2 leading-tight">{content.ui.related}</h2>
            <ul className="grid gap-3">{content.guides.filter((item) => item.slug !== guide.slug).map((item) => <li key={item.slug}><Link href={guidePath(item.slug)} className="inline-block py-2 underline underline-offset-4">{item.title}</Link></li>)}</ul>
          </nav>
          <p className="text-small text-muted-foreground">{content.ui.notice}</p>
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </main>
  );
}


import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { siteName, siteUrl } from '@/lib/site';

const TITLE = "How to compare driving schools for a Swedish driver's licence in Stockholm";
const DESCRIPTION =
  'A practical Stockholm guide to the Swedish licence path, authorized driving schools, published prices, availability and booking through DriveLinkUp.';
const PUBLISHED = '2026-08-02';
const MODIFIED = '2026-09-05';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog/swedish-drivers-license-expat-stockholm' },
};

export default function SwedishDriversLicenseExpatStockholmPost() {
  const url = `${siteUrl}/blog/swedish-drivers-license-expat-stockholm`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    inLanguage: 'en',
    keywords:
      'Stockholm driving school, Swedish driving licence, Transportstyrelsen, Trafikverket, DriveLinkUp',
    author: { '@type': 'Organization', name: siteName, url: siteUrl },
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <main className="container-page section">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="grid gap-4">
          <p className="text-eyebrow">Article · Stockholm learners</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight">{TITLE}</h1>
          <p className="text-body-lg text-muted-foreground">{DESCRIPTION}</p>
          <p className="text-small text-muted-foreground">
            By {siteName} · Updated 5 September 2026
          </p>
        </header>
        <div className="surface-panel grid gap-8 rounded-xl border border-border p-6 text-body leading-relaxed sm:p-10">
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Start with the official path</h2>
            <p>
              A Swedish category B licence normally involves a learner&apos;s permit from
              Transportstyrelsen, risk education, theory preparation and a practical driving test
              through Trafikverket. Requirements depend on your situation, so check current official
              guidance before booking.
            </p>
            <p>
              Driving schools help learners build practical skills. If you also practise privately,
              the learner and Swedish handledare must follow the rules for private övningskörning. A
              handledare is a separate private-supervisor role, not a driving school.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">Compare the details that matter</h2>
            <p>
              Stockholm has different lesson formats, languages, locations and calendars. Use
              DriveLinkUp to compare authorized-school listings by licence category, published
              price, availability, language and cancellation policy. The school controls what it
              publishes, so confirm remaining questions before the lesson.
            </p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>Choose the licence category and Stockholm area that fit your plan.</li>
              <li>Compare school prices, languages, open slots and booking policies.</li>
              <li>Book the school and time that fit; the school price is your learner total.</li>
            </ol>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">
              What booking costs on DriveLinkUp
            </h2>
            <p>
              Learners can discover, compare and book for free. DriveLinkUp adds no separate learner
              fee: checkout uses the authorized school&apos;s published booking price. Schools
              control their prices and availability and pay 10% of attributable booking value only
              after the service is completed.
            </p>
            <p>
              This explains the marketplace relationship; it does not promise booking volume, lesson
              outcomes or settlement timing. Cancellation terms remain the policy shown on the
              school listing and saved with the booking.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-display text-h2 leading-tight">A useful Stockholm checklist</h2>
            <p>
              Before you meet, confirm the category, meeting point, language, lesson duration,
              vehicle arrangement and cancellation terms. Keep your learner permit and required
              documentation ready. For official legal or test questions, use Transportstyrelsen and
              Trafikverket as the source of truth.
            </p>
          </section>
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
            <Button asChild>
              <Link href="/instructors/stockholm">Compare Stockholm schools</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/faq">Read the marketplace FAQ</Link>
            </Button>
          </div>
        </div>
      </article>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </main>
  );
}

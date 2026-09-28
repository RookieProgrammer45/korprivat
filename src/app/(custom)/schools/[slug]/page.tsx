import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import { getOrganizationBySlug, listSchoolListedInstructors } from '@/lib/orgs/public';
import { siteName, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) {
    return { title: 'DriveLinkUp', robots: { index: false, follow: false } };
  }
  const city = org.city?.trim() || 'Sverige';
  const title = `${org.name} — trafikskola i ${city} | DriveLinkUp`;
  const description = `${org.name} på DriveLinkUp — auktoriserad trafikskola i ${city}.`;
  const canonical = `/schools/${org.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: `${siteUrl}${canonical}`,
    },
  };
}

export default async function SchoolProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  const t = await getTranslations('schoolProfile');
  const instructors = await listSchoolListedInstructors(org.id);
  const publicRows = instructors.filter(hasCanonicalCategory);
  const aggregates = await loadPublicInstructorAggregates(
    publicRows.map((row) => ({ id: row.id, userId: row.userId })),
  );
  const items = publicRows.map((row) => {
    const aggregate = aggregates.get(row.id) ?? {
      verificationStatus: 'unverified' as const,
      reviewSummary: { count: 0, averageRating: null },
    };
    return toPublicInstructor(row, aggregate, null);
  });

  const verified = org.verificationState === 'APPROVED';
  const city = org.city?.trim() || null;
  const pageUrl = `${siteUrl}/schools/${org.slug}`;

  const addressParts = [org.address, org.postcode, org.city].filter(Boolean);
  const ratings = items
    .map((i) => i.reviewSummary.averageRating)
    .filter((r): r is number => typeof r === 'number');
  const reviewCount = items.reduce((sum, i) => sum + i.reviewSummary.count, 0);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DrivingSchool',
    name: org.name,
    url: pageUrl,
    ...(addressParts.length > 0
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: org.address ?? undefined,
            postalCode: org.postcode ?? undefined,
            addressLocality: org.city ?? undefined,
            addressCountry: org.country || 'SE',
          },
        }
      : {}),
    ...(org.contactEmail ? { email: org.contactEmail } : {}),
    ...(org.contactPhone ? { telephone: org.contactPhone } : {}),
    ...(avgRating != null && reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating,
            reviewCount,
          },
        }
      : {}),
  };

  return (
    <main className="container-page min-w-0">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD from server data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto grid w-full max-w-4xl gap-8 py-section">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
              {org.name}
            </h1>
            <Badge
              variant="outline"
              className={
                verified
                  ? 'border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                  : 'border-border bg-muted text-muted-foreground'
              }
            >
              {verified ? t('verifiedBadge') : t('pendingBadge')}
            </Badge>
          </div>
          {city ? <p className="text-body text-muted-foreground">{city}</p> : null}
        </header>

        {(org.contactEmail || org.contactPhone || addressParts.length > 0) && (
          <section className="grid gap-2">
            <h2 className="font-display text-h3 text-foreground">{t('contactHeading')}</h2>
            {addressParts.length > 0 ? (
              <p className="text-body text-muted-foreground">{addressParts.join(', ')}</p>
            ) : null}
            {org.contactEmail ? (
              <p className="text-body text-muted-foreground">{org.contactEmail}</p>
            ) : null}
            {org.contactPhone ? (
              <p className="text-body text-muted-foreground">{org.contactPhone}</p>
            ) : null}
          </section>
        )}

        <section className="grid gap-4">
          <h2 className="font-display text-h3 text-foreground">{t('instructorsHeading')}</h2>
          {items.length === 0 ? (
            <p className="text-body text-muted-foreground">{t('noInstructors')}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map((instructor) => (
                <li key={instructor.id}>
                  <Card className="border-border bg-card">
                    <CardContent className="flex gap-4 p-4">
                      <Image
                        src={instructor.photoUrl}
                        alt=""
                        width={72}
                        height={72}
                        unoptimized
                        className="size-[72px] rounded-lg object-cover"
                      />
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className="truncate font-medium text-foreground">{instructor.name}</p>
                        <p className="text-small text-muted-foreground">{instructor.city}</p>
                        <Button asChild variant="link" size="sm" className="h-auto w-fit p-0">
                          <Link href={`/instructors/${instructor.id}`}>{instructor.name}</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

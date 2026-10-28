//
// Server Component — exports `metadata` (page.title / page.description /
// canonical) so the route gets a clean `<title>`, social previews, and a
// canonical URL even though most of the body is an interactive client island.
//
// The page ONLY renders text + a client island; it never fetches data.
// `?topic=` deep-linking is validated through `resolveContactTopic` so an
// invalid alias (e.g. `?topic=garbage`) silently falls back to "no
// preselection" instead of erroring or throwing a server error.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactDirectoryCtas } from '@/components/custom/contact-directory-ctas';
import { ContactFlow } from '@/components/custom/contact-flow';
import { parseClaimListingPath, parseClaimSchoolName } from '@/lib/contact/claim-listing';
import { resolveContactTopic } from '@/lib/contact/schema';
import { siteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing.contactPage');
  return {
    title: {
      absolute: `${t('eyebrow')} · DriveLinkUp`,
    },
    description: t('lead'),
    alternates: { canonical: '/contact' },
  };
}

interface ContactPageProps {
  searchParams?: Promise<{
    topic?: string | string[];
    school?: string | string[];
    listing?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = (await searchParams) ?? {};
  const rawTopic = firstParam(params.topic);
  const initialTopic = resolveContactTopic(rawTopic);
  const schoolName = parseClaimSchoolName(firstParam(params.school));
  const listingPath = parseClaimListingPath(firstParam(params.listing));
  const tClaim = await getTranslations('schoolContact');
  const initialMessage =
    schoolName && listingPath
      ? tClaim('claimPrefill', { name: schoolName, listing: `${siteUrl}${listingPath}` })
      : schoolName
        ? tClaim('claimPrefillName', { name: schoolName })
        : null;

  return (
    <main className="container-page section w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-8">
        <ContactDirectoryCtas />
        <ContactFlow initialTopic={initialTopic} initialMessage={initialMessage} />
      </div>
    </main>
  );
}

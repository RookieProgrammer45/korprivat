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
import { resolveContactTopic } from '@/lib/contact/schema';

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
  searchParams?: Promise<{ topic?: string | string[] }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = (await searchParams) ?? {};
  const rawTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const initialTopic = resolveContactTopic(rawTopic);

  return (
    <main className="container-page section w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-8">
        <ContactDirectoryCtas />
        <ContactFlow initialTopic={initialTopic} />
      </div>
    </main>
  );
}

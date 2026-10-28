import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicFaq } from '@/components/custom/public-faq';
import { publicAlternates } from '@/lib/seo/alternates';

const FAQ_KEYS = [
  'scope',
  'choose',
  'booking',
  'price',
  'safety',
  'cancellation',
  'prerequisites',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faqPage.header');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: publicAlternates('/faq'),
  };
}

export default async function FaqPage() {
  const t = await getTranslations('faqPage');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_KEYS.map((key) => ({
      '@type': 'Question',
      name: t(`items.${key}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`items.${key}.a`) },
    })),
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <PublicFaq />
    </>
  );
}

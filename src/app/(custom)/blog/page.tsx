import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import content from '../../../../messages/europe-driving-guides.en.json';
import { publicAlternatesFor } from '@/lib/seo/alternates';

const POSTS = [
  { slug: 'korkort-b-malmo', index: '11', minutes: 8 },
  { slug: 'korkort-b-goteborg', index: '10', minutes: 8 },
  { slug: 'korlektion-korkort-b', index: '9', minutes: 8 },
  { slug: 'korkortstillstand-korkort-b', index: '8', minutes: 8 },
  { slug: 'riskutbildning-korkort-b', index: '7', minutes: 8 },
  { slug: 'korprov-korkort-b', index: '6', minutes: 8 },
  { slug: 'kunskapsprov-korkort-b', index: '5', minutes: 8 },
  { slug: 'korkort-b-steg-for-steg', index: '4', minutes: 7 },
  { slug: 'swedish-drivers-license-expat-stockholm', index: '0', minutes: 7 },
  { slug: 'handledare-ovningskorning-sverige', index: '1', minutes: 6 },
  { slug: 'kostnad-korkort-sverige', index: '2', minutes: 5 },
  { slug: 'trafikskola-eller-handledare', index: '3', minutes: 5 },
] as const;

export async function generateMetadata() {
  const t = await getTranslations('blogPage.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: await publicAlternatesFor('/blog'),
  };
}

export default async function BlogIndexPage() {
  const tHeader = await getTranslations('blogPage.header');
  const renderedPosts = await Promise.all(
    POSTS.map(async (post) => {
      const tPost = await getTranslations(`blogPage.posts.${post.index}`);
      return {
        ...post,
        eyebrow: tPost('eyebrow'),
        title: tPost('title'),
        excerpt: tPost('excerpt'),
        meta: tPost('meta', { minutes: post.minutes }),
        readCta: tPost('readCta'),
      };
    }),
  );

  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{tHeader('eyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
          {tHeader('title')}
        </h1>
        <p className="max-w-2xl text-body-lg text-muted-foreground">
          {tHeader('subtitle')}
        </p>
      </header>
      <section
        lang="en"
        aria-label={content.ui.related}
        className="mx-auto mt-10 grid max-w-3xl gap-6"
      >
        {content.guides.map((guide) => (
          <article
            key={guide.slug}
            className="surface-card rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
              <Link href={`/en/blog/${guide.slug}`} className="underline underline-offset-4">
                {guide.title}
              </Link>
            </h2>
            <p className="mt-3 text-body text-muted-foreground">{guide.description}</p>
          </article>
        ))}
      </section>
      <div className="mx-auto mt-10 grid max-w-3xl gap-6">
        {renderedPosts.map((post) => (
          <article
            key={post.slug}
            className="surface-card rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <p className="text-eyebrow">{post.eyebrow}</p>
            <h2 className="mt-2 font-display text-h3 leading-tight tracking-tight text-foreground">
              {post.title}
            </h2>
            <p className="mt-3 text-body text-muted-foreground">{post.excerpt}</p>
            <p className="mt-3 text-small text-muted-foreground">{post.meta}</p>
            <p className="mt-4">
              <Link
                href={`/blog/${post.slug}`}
                className="font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
              >
                {post.readCta}
                <span aria-hidden className="ml-1">
                  →
                </span>
              </Link>
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}

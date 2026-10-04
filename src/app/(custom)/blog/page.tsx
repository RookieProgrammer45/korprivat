// message namespace; renders one editorial card per published post. Static
// SSR shape (no `'use client'`, no server-only imports, no fetch) — the
// post page itself is hand-written JSX so a markdown renderer is unjustified
// while there is only one article in the corpus.
//
// Editing a post? Update src/app/(custom)/blog/<slug>/page.tsx and add an
// entry under `blogPage.posts.<index>` — both message files must mirror.
// Adding a second post? Push another literal into POSTS and add the matching
// `blogPage.posts.<index>` block; render stays a flat card stack.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const POSTS = [
  {
    slug: 'swedish-drivers-license-expat-stockholm',
    index: '0',
    minutes: 7,
  },
  {
    slug: 'handledare-ovningskorning-sverige',
    index: '1',
    minutes: 6,
  },
  {
    slug: 'kostnad-korkort-sverige',
    index: '2',
    minutes: 5,
  },
  {
    slug: 'trafikskola-eller-handledare',
    index: '3',
    minutes: 5,
  },
] as const;

export async function generateMetadata() {
  const t = await getTranslations('blogPage.meta');
  const { publicAlternates } = await import('@/lib/seo/alternates');
  return {
    title: t('title'),
    description: t('description'),
    alternates: publicAlternates('/blog'),
  };
}

export default async function BlogIndexPage() {
  const tHeader = await getTranslations('blogPage.header');
  // Resolve every post's copy up front so the JSX below stays sync and the
  // blogPage.posts.<index> namespace is unambiguously bound at request time.
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
        <p className="max-w-2xl text-body-lg text-muted-foreground">{tHeader('subtitle')}</p>
      </header>

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

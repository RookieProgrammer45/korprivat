import 'server-only';
import dataset from '../../../data/business-logos/logos.json';

const byKey = dataset.byKey as Record<string, string>;

/** Logo URL scraped from the business's own site, keyed by listing or catalogue id. */
export function publishedLogo(id: string | null | undefined): string | null {
  if (!id) return null;
  const url = byKey[id];
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

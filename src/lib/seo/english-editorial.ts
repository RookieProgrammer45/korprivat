import content from '../../../messages/europe-driving-guides.en.json';

/** Explicit English-only editorial URLs; do not expand these into locale variants. */
export function englishEditorialPaths(): string[] {
  return content.guides.map((guide) => `/en/blog/${guide.slug}`);
}

import type { ReactElement } from 'react';

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Next.js JSON-LD helper: stringify and escape `<` so the payload cannot break out of the script tag. */
export function jsonLdScript(data: unknown): ReactElement {
  const json = serializeJsonLd(data);
  return <script type="application/ld+json">{json}</script>;
}

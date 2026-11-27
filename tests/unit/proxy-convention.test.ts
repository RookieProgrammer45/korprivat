import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Next 16 webpack production builds only scan the parent of src/app for
// proxy.ts. A root-level file is picked up by `next dev` but never compiled
// into .next/server/middleware.js, so locale prefixes 404 and CSP never lands.
describe('proxy convention', () => {
  it('keeps proxy.ts under src/ next to instrumentation.ts', () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, 'src/proxy.ts'))).toBe(true);
    expect(existsSync(path.join(root, 'src/instrumentation.ts'))).toBe(true);
    expect(existsSync(path.join(root, 'proxy.ts'))).toBe(false);
  });

  it('rewrites locale prefetches instead of skipping them', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/proxy.ts'), 'utf8');
    expect(source).toContain('private, no-store');
    expect(source).not.toContain('next-router-prefetch');
    expect(source).not.toContain("purpose', value: 'prefetch'");
  });
});

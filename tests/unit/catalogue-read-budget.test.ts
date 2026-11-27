import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FILE_BUDGET = 8_000_000;
const TOTAL_BUDGET = 12_000_000;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

function jsonImports(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+\.json)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

describe('catalogue read budget', () => {
  it('keeps imported catalogue files inside the server memory budget', () => {
    const files = sourceFiles(join(ROOT, 'src'));
    const imported = new Map<string, number>();
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of jsonImports(source)) {
        const path = resolve(join(file, '..'), specifier);
        imported.set(path, statSync(path).size);
      }
    }
    expect(imported.size).toBeGreaterThan(0);
    for (const [path, size] of imported) {
      expect(size, path).toBeLessThan(FILE_BUDGET);
    }
    const total = [...imported.values()].reduce((sum, size) => sum + size, 0);
    expect(total).toBeLessThan(TOTAL_BUDGET);
  });

  it('keeps catalogue files out of client components', () => {
    const files = sourceFiles(join(ROOT, 'src'));
    const loaders = new Set(
      files.filter((file) => jsonImports(readFileSync(file, 'utf8')).length > 0),
    );
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!source.slice(0, 400).includes('use client')) continue;
      const valueImports = source
        .split('\n')
        .filter((line) => line.includes(' from ') && !line.trimStart().startsWith('import type'));
      for (const line of valueImports) {
        const match = line.match(/from\s+['"]@\/([^'"]+)['"]/);
        const specifier = match?.[1];
        if (!specifier) continue;
        const imported = resolve(ROOT, 'src', specifier);
        const candidates = [`${imported}.ts`, `${imported}.tsx`, join(imported, 'index.ts')];
        if (candidates.some((candidate) => loaders.has(candidate))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

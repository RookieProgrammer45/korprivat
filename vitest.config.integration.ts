// @polsia:user-owned — integration test config.
//
// The framework-owned vitest.config.ts only includes tests/unit/** (audit +
// contract tests). This file is the integration companion: it ADDS the
// tests/integration/** entry so the booking-flow + auth-flank + race-guard
// suite runs end-to-end against mocked Prisma + mocked Stripe proxy +
// mocked email proxy.
//
// We deliberately DO NOT edit the framework config; we don't add a
// "test:integration" npm script (would touch package.json) — invoke
// `npx vitest run --config vitest.config.integration.ts` instead.
//
// biome: this file is OUTSIDE the overrides' src/ globs so it gets the
// default rule set, which means we cannot import restricted paths here.
// That's fine — helpers and route handlers reach those imports for us.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/unit/**'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});

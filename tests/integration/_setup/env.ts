// @polsia:user-owned — integration-suite env stub.
//
// Sets the minimum env the typed-env module accepts before any test file
// imports a route handler. Each test file imports this FIRST so the values
// are in place by the time `@/lib/env` evaluates:
//
//   - SKIP_ENV_VALIDATION=1 — bypasses @t3-oss validation entirely
//     (we'll never reach the env module in these tests, but the sandbox may
//     run a build/lint that touches transitive imports).
//   - DATABASE_URL — required by @t3-oss + by the Prisma client's module-init
//     even when every call is mocked. A real-looking URL is fine because no
//     test reaches a live DB; the prisma-mock replaces it.
//   - the rest mirrors the real deploy env so any deeper transitive reads
//     resolve cleanly.
//
// We DO NOT touch .env or process.env outside this file — these values
// belong to the test run, not the CLI's ambient env.
//
// biome: this file is restricted from importing server-only paths BUT only
// by the default rule; we never @import anything that triggers
// noRestrictedImports. The single top-level side-effect line is intentional.

process.env.SKIP_ENV_VALIDATION = '1';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET ??= 'integration-test-secret-not-used-anywhere-real';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
process.env.POLSIA_API_BASE_URL ??= 'http://localhost:9999';
process.env.POLSIA_API_KEY ??= 'integration-test-polsia-key';
process.env.POLSIA_EMAIL_PROXY_URL ??= 'http://localhost:9998';
// NODE_ENV is read-only in the process.env type — set via Node's NODE_ENV
// or pass SKIP_ENV_VALIDATION alone. The default is 'development' which
// is fine for the integration suite.

export {};

//
// Sets the minimum env the typed-env module accepts before any test file
// imports a route handler.

process.env.SKIP_ENV_VALIDATION = '1';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET ??= 'integration-test-secret-not-used-anywhere-real';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_integration';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_integration';
process.env.OPENAI_API_KEY ??= 'sk-test-openai';
process.env.BLOB_READ_WRITE_TOKEN ??= 'vercel_blob_test_token';

export {};

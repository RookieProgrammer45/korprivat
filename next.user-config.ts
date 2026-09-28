// Next.js customizations merged into next.config.ts.
// Do not put security headers / CSP / a full `images` block here.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import type { AppCapabilities } from './src/lib/permissions-policy';
import { cspExtraSources } from './src/lib/csp-extra-sources';

export { cspExtraSources };

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

/** Remote hosts you load <Image> from. e.g. { protocol: 'https', hostname: 'images.unsplash.com' } */
export const userRemotePatterns: RemotePatterns = [
  {
    protocol: 'https',
    hostname: 'lh3.googleusercontent.com',
    pathname: '/**',
  },
];

/**
 * Browser capabilities this app needs (drives the Permissions-Policy header).
 * Default: everything OFF — the app cannot even PROMPT for these, so e.g. audio
 * recording never starts. Flip one to `true` to emit `<feature>=(self)`, which
 * lets THIS origin request it; the browser's own permission prompt is still the
 * gate (the user must click Allow). Leave features you don't use OFF — declaring
 * unused device permissions is flagged by security audits.
 *   microphone  → getUserMedia({ audio }), MediaRecorder (voice recording)
 *   camera      → getUserMedia({ video }) (video calls, QR scan, photo)
 *   geolocation → navigator.geolocation ("near me", maps)
 */
export const appCapabilities: AppCapabilities = {
  microphone: false,
  camera: false,
  geolocation: true,
};

/** Package-level Next options (transpilePackages, experimental.optimizePackageImports, …). */
export const userNextConfig: NextConfig = {};

export type ConfigPlugin = (config: NextConfig) => NextConfig;

/**
 * Next plugins that must WRAP the whole config (next-intl, Sentry, MDX,
 * bundle-analyzer). Each entry is a `(config) => config` wrapper — pre-bind
 * options. next.config.ts applies these and re-asserts the security headers
 * afterward, so a plugin can extend the build but never drop the day-1 posture.
 * For i18n, install the `i18n` module and add its plugin here per its AGENT.md.
 *
 *   export const userConfigPlugins: ConfigPlugin[] = [
 *     createNextIntlPlugin('./src/i18n/request.ts'),
 *     (config) => withSentryConfig(config, { silent: true }),
 *   ];
 */
export const userConfigPlugins: ConfigPlugin[] = [createNextIntlPlugin('./src/i18n/request.ts')];

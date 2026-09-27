import Link from 'next/link';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';

/**
 * Shared auth layout contract:
 * - Brand is the primary landmark (Airbnb/Uber-style)
 * - One narrow column, no decorative card chrome
 * - Locale stays available without competing with the form
 */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-shell flex min-h-dvh min-w-0 flex-col bg-[var(--background)]">
      <header className="auth-shell-topbar mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-gutter pt-6 sm:pt-8">
        <Link
          href="/"
          aria-label="DriveLinkUp"
          className="group flex min-w-0 items-center text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 48"
            width={132}
            height={26}
            role="img"
            aria-labelledby="auth-logo-title"
            className="h-[1.625rem] w-auto max-w-full transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300"
          >
            <title id="auth-logo-title">DriveLinkUp</title>
            <g transform="translate(24 24)" fill="currentColor">
              <g transform="rotate(-45)">
                <path
                  fillRule="evenodd"
                  d="M-14.5 -3.8 h29 a5.3 5.3 0 0 1 0 10.6 h-29 a5.3 5.3 0 0 1 0 -10.6 z M-10.7 -2.65 h21.4 a2.65 2.65 0 0 1 0 5.3 h-21.4 a2.65 2.65 0 0 1 0 -5.3 z"
                />
              </g>
              <rect x="-3.9" y="-3.9" width="7.8" height="7.8" transform="rotate(45)" />
              <g transform="rotate(45)">
                <path
                  fillRule="evenodd"
                  d="M-14.5 -3.8 h29 a5.3 5.3 0 0 1 0 10.6 h-29 a5.3 5.3 0 0 1 0 -10.6 z M-10.7 -2.65 h21.4 a2.65 2.65 0 0 1 0 5.3 h-21.4 a2.65 2.65 0 0 1 0 -5.3 z"
                />
                <circle cx="0" cy="0" r="1.6" />
                <rect x="-0.55" y="-1.6" width="1.1" height="3.2" />
              </g>
              <circle cx="0" cy="0" r="1.6" transform="rotate(-45)" />
              <rect x="-0.55" y="-1.6" width="1.1" height="3.2" transform="rotate(-45)" />
            </g>
            <text
              x="62"
              y="33"
              fontFamily="Syne, Avenir Next, sans-serif"
              fontSize="24"
              fontWeight="600"
              letterSpacing="-0.48"
              fill="currentColor"
            >
              DriveLinkUp
            </text>
          </svg>
        </Link>
        <LocaleSwitcher />
      </header>

      <div className="auth-shell-body mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col justify-center px-gutter py-10 sm:py-14">
        <div className="auth-panel w-full min-w-0">{children}</div>
        {footer ? (
          <div className="mt-8 text-center text-small text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

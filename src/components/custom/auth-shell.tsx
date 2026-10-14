import Link from 'next/link';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';

/**
 * Shared auth layout contract:
 * - Brand is the primary landmark (Airbnb/Uber-style)
 * - One narrow column, no decorative card chrome
 * - Locale stays available without competing with the form
 * - 2026-10-14 restyle: on large screens a decorative "övningskör" carousel
 *   panel sits to the left of the form column (static, aria-hidden).
 */

const LESSON_VIGNETTE = (
  <svg width="64" height="46" viewBox="0 0 64 46" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <circle cx="32" cy="9" r="6" />
    <path d="M15 32 Q32 17 49 32" />
    <ellipse cx="32" cy="29" rx="15" ry="11" />
    <ellipse cx="32" cy="29" rx="5.5" ry="3.5" />
    <circle cx="18" cy="25" r="3.2" fill="currentColor" stroke="none" />
    <circle cx="46" cy="25" r="3.2" fill="currentColor" stroke="none" />
    <path d="M6 42 h8 M20 42 h8 M34 42 h8" className="dlu-road-faint" />
    <path d="M48 42 h10" className="dlu-road-active" />
  </svg>
);

function LessonCard({
  name,
  chip,
  meta,
  progress,
  className,
  variant,
}: {
  name: string;
  chip: string;
  meta: string;
  progress?: number;
  className: string;
  variant: 'full' | 'compact';
}) {
  return (
    <article className={`dlu-card dlu-lesson ${className}`}>
      <div className="dlu-top">
        <span className="dlu-vin">{LESSON_VIGNETTE}</span>
        <div className="min-w-0">
          <p className="dlu-name">{name}</p>
          <span className="dlu-chip">{chip}</span>
        </div>
      </div>
      <p className="dlu-lang">{meta}</p>
      {variant === 'full' && progress != null ? (
        <div className="dlu-bar" aria-hidden>
          <i style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </article>
  );
}

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-shell flex min-h-dvh min-w-0 flex-col bg-[var(--background)]">
      <div className="auth-shell-grid mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-12 lg:px-6">
        <aside className="auth-shell-art relative hidden overflow-hidden lg:flex lg:w-[420px] lg:shrink-0 lg:flex-col" aria-hidden>
          <span className="dlu-glow" />
          <p className="dlu-tag">Övningskör · steg för steg</p>
          <div className="dlu-deck dlu-deck-lesson">
            <LessonCard
              className="dlu-front"
              name="Ella, 18"
              chip="Lektion 12 av 20"
              meta="tis 07:45 · Globens Trafikskolan"
              progress={60}
              variant="full"
            />
            <LessonCard
              className="dlu-back-1"
              name="Yusuf, 24"
              chip="Vinterkörning"
              meta="ons 17:30 · City Trafikskolan"
              variant="compact"
            />
            <LessonCard
              className="dlu-back-2"
              name="Maja, 31"
              chip="Första lektionen"
              meta="fre 14:15 · E6 Trafikskola"
              variant="compact"
            />
          </div>
          <div className="dlu-nav">
            <span className="dlu-nav-btn dlu-nav-muted">←</span>
            <span className="dlu-nav-btn">→</span>
          </div>
          <div className="dlu-dots">
            <i className="dlu-on" />
            <i />
            <i />
          </div>
          <p className="dlu-count">övningskör — en lektion i taget</p>
          <p className="dlu-free">
            <i className="dlu-free-dot" />
            Kostnadsfritt för elever
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
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
        </div>
      </div>
    </main>
  );
}

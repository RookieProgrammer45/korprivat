// Desktop-only photo carousel for the auth split (signup and login).

'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PUBLIC_CATALOG_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import { InstructorList } from '@/lib/contracts/instructors';
import { schoolPortraitUrl } from '@/lib/discovery/school-portrait';

const FALLBACK_SRC = '/images/hero-lesson.jpg';
const ROTATION_MS = 5500;

type Slide = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return reduced;
}

export function AuthSchoolCarousel() {
  const t = useTranslations('auth.visual');
  const reduceMotion = usePrefersReducedMotion();
  const [slides, setSlides] = useState<Slide[]>([
    { id: 'lesson', src: FALLBACK_SRC, alt: t('lessonAlt') },
  ]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/instructors?limit=${PUBLIC_CATALOG_PREVIEW_LIMIT}`, {
      schema: InstructorList,
    })
      .then((data) => {
        if (!alive) return;
        const schools = data.items
          .map((row) => ({ row, src: schoolPortraitUrl(row.photoUrl) }))
          .filter((entry): entry is { row: (typeof data.items)[number]; src: string } =>
            Boolean(entry.src),
          )
          .map(({ row, src }) => ({
            id: row.id,
            src,
            alt: t('schoolAlt', { name: row.name, city: row.city }),
            caption: `${row.name} · ${row.city}`,
          }));
        if (schools.length === 0) return;
        setSlides([{ id: 'lesson', src: FALLBACK_SRC, alt: t('lessonAlt') }, ...schools]);
        setActive(0);
      })
      .catch(() => {
        // Keep the lesson photograph if the teaser is unavailable.
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const count = slides.length;

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, count]);

  return (
    <aside
      className="auth-visual relative hidden min-h-dvh overflow-hidden lg:block lg:h-full"
      aria-label={t('label')}
      aria-roledescription={t('role')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`auth-visual-slide absolute inset-0 ${index === active ? 'is-active' : ''}`}
          aria-hidden={index !== active}
        >
          <Image
            src={slide.src}
            alt={index === active ? slide.alt : ''}
            fill
            priority={index === 0}
            unoptimized={slide.src !== FALLBACK_SRC}
            sizes="50vw"
            className="object-cover"
          />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      {slides[active]?.caption ? (
        <p className="auth-visual-caption">{slides[active].caption}</p>
      ) : null}
      {count > 1 ? (
        <div className="auth-visual-dots">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={index === active ? 'auth-visual-dot is-on' : 'auth-visual-dot'}
              aria-label={t('goTo', { n: index + 1 })}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

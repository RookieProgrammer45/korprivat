'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { type SchoolHeavyAdvertised, schoolPortraitUrl } from '@/lib/discovery/school-portrait';
import { SchoolMarkFallback } from '@/components/custom/school-mark-fallback';
import { type InstructorFilteredItem, InstructorList } from '@/lib/contracts/instructors';

/**
 * The live profile deck used on the auth shell (signup/login).
 * Same data source and behaviour as the hero deck on the marketplace home:
 * real profiles from /api/instructors, auto-rotation, arrows and dots.
 */

const LANGUAGE_LABELS: Record<string, string> = {
  sv: 'Svenska',
  en: 'Engelska',
  ar: 'Arabiska',
  fa: 'Persiska',
  so: 'Somaliska',
  pl: 'Polska',
  es: 'Spanska',
  de: 'Tyska',
  tr: 'Turkiska',
  fr: 'Franska',
  ur: 'Urdu',
  fi: 'Finska',
  no: 'Norska',
  da: 'Danska',
  is: 'Isländska',
  it: 'Italienska',
  nl: 'Nederländska',
  pt: 'Portugisiska',
  cs: 'Tjeckiska',
  hu: 'Ungerska',
  ro: 'Rumänska',
  bg: 'Bulgariska',
  hr: 'Kroatiska',
  sl: 'Slovenska',
  sk: 'Slovakiska',
  el: 'Grekiska',
  et: 'Estniska',
  lv: 'Lettiska',
  lt: 'Litauiska',
};

type DeckProfile = {
  id: string;
  name: string;
  photoUrl: string;
  type: 'Skola' | 'Instruktör';
  categories: string[];
  heavy: SchoolHeavyAdvertised | null;
  city: string;
  chip: string | null;
  languages: string;
  nextSlot: string | null;
};

const MAX_DECK_PROFILES = 10;
const ROTATION_MS = 4800;

function formatSekChip(rate: number | null): string | null {
  if (typeof rate !== 'number' || rate <= 0) return null;
  return `fr. ${rate} kr`;
}

function formatSlot(iso: string): string | null {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return null;
  }
}

function toDeckProfile(row: InstructorFilteredItem): DeckProfile {
  const languages = (row.languages ?? [])
    .map((code) => LANGUAGE_LABELS[code] ?? code.toUpperCase())
    .join(' · ');
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photoUrl,
    type: row.providerType === 'INSTRUCTOR' ? 'Instruktör' : 'Skola',
    categories: row.providerType === 'SCHOOL' ? row.categories : [],
    heavy: row.providerType === 'SCHOOL' ? (row.publishedPrices?.heavy ?? null) : null,
    city: row.city,
    chip: formatSekChip(row.hourlyRateSek),
    languages: languages || 'Svenska',
    nextSlot: row.nextSlotAt ? formatSlot(row.nextSlotAt) : null,
  };
}

export function LiveAuthDeck() {
  const [profiles, setProfiles] = useState<DeckProfile[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/instructors', { schema: InstructorList })
      .then((data) => {
        if (!alive) return;
        const rows = data.items.slice(0, MAX_DECK_PROFILES).map(toDeckProfile);
        if (rows.length > 0) {
          setProfiles(rows);
          setActive(0);
        }
      })
      .catch(() => {
        if (!alive) return;
      });
    return () => {
      alive = false;
    };
  }, []);

  const count = profiles.length;
  const front = count > 0 ? profiles[active % count] : undefined;
  const back1 = count > 1 ? profiles[(active + 1) % count] : undefined;
  const back2 = count > 2 ? profiles[(active + 2) % count] : undefined;

  useEffect(() => {
    if (paused || count < 2) return;
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATION_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused, count]);

  if (!front) return null;

  const go = (step: number) => {
    setActive((current) => (current + step + count) % count);
  };

  return (
    <div className="live-auth-deck">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dekorativ hover-paus for kortspel - grafik, ej interaktiv kontroll */}
      <div
        className="dlu-deck dlu-deck-live"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <article className="dlu-card" key={front.id}>
          <div className="dlu-top">
            <div className="dlu-id min-w-0">
              {schoolPortraitUrl(front.photoUrl) ? (
                // biome-ignore lint/performance/noImgElement: avatar-URL fran data, fast 44px - next/image lar ingen vinst
                <img
                  className="dlu-photo"
                  src={schoolPortraitUrl(front.photoUrl) ?? ''}
                  alt=""
                  width={44}
                  height={44}
                />
              ) : front.type === 'Skola' ? (
                <SchoolMarkFallback
                  name={front.name}
                  categories={front.categories}
                  heavy={front.heavy}
                  iconClassName="size-5"
                  className="dlu-photo flex items-center justify-center font-display text-sm font-normal"
                />
              ) : (
                <span className="dlu-photo flex items-center justify-center font-display text-sm font-normal">
                  {front.name.trim().slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="dlu-type">{front.type}</p>
                <p className="dlu-name">{front.name}</p>
                <p className="dlu-city">{front.city}</p>
              </div>
            </div>
            {front.chip ? <span className="dlu-chip">{front.chip}</span> : null}
          </div>
          <p className="dlu-lang">{front.languages}</p>
          <div className="dlu-row">
            <span className="dlu-slot">
              Nästa lediga tid
              <b>{front.nextSlot ?? 'Påförfrågan'}</b>
            </span>
            <Link href="/signup" className="dlu-btn">
              Kom igång
            </Link>
          </div>
        </article>
        {back1 ? (
          <article className="dlu-card dlu-back-1" key={back1.id}>
            <div className="dlu-top">
              <div className="min-w-0">
                <p className="dlu-type">{back1.type}</p>
                <p className="dlu-name">{back1.name}</p>
                <p className="dlu-city">{back1.city}</p>
              </div>
              {back1.chip ? <span className="dlu-chip">{back1.chip}</span> : null}
            </div>
            <p className="dlu-lang">{back1.languages}</p>
          </article>
        ) : null}
        {back2 ? (
          <article className="dlu-card dlu-back-2" key={back2.id}>
            <div className="dlu-top">
              <div className="min-w-0">
                <p className="dlu-type">{back2.type}</p>
                <p className="dlu-name">{back2.name}</p>
                <p className="dlu-city">{back2.city}</p>
              </div>
              {back2.chip ? <span className="dlu-chip">{back2.chip}</span> : null}
            </div>
          </article>
        ) : null}
      </div>
      <div className="dlu-nav">
        <button
          type="button"
          className="dlu-nav-btn"
          aria-label="Föregående profil"
          onClick={() => go(-1)}
        >
          ←
        </button>
        <button
          type="button"
          className="dlu-nav-btn"
          aria-label="Nästa profil"
          onClick={() => go(1)}
        >
          →
        </button>
      </div>
      <div className="dlu-dots">
        {profiles.map((profile, index) => (
          <button
            type="button"
            key={profile.id}
            className={index === active ? 'dlu-dot dlu-on' : 'dlu-dot'}
            aria-label={`Visa ${profile.name}`}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
      <p className="dlu-count">{count} profiler i rotation</p>
      <p className="dlu-free">
        <i aria-hidden />
        Kostnadsfritt för elever
      </p>
    </div>
  );
}

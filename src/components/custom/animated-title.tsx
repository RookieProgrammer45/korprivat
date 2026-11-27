'use client';

import { useEffect, useState } from 'react';

const WORD_DELAY_MS = 55;
const LINE_HOLD_MS = 3400;

type AnimatedTitleProps = {
  as?: 'h1' | 'h2' | 'p';
  text: string;
  className?: string;
};

export function AnimatedTitle({ as: Tag = 'h1', text, className }: AnimatedTitleProps) {
  const parts = text.split(/(\s+)/);
  const seen = new Map<string, number>();

  return (
    <Tag className={className}>
      {parts.map((part, index) => {
        if (part.trim() === '') return part;
        const occurrence = (seen.get(part) ?? 0) + 1;
        seen.set(part, occurrence);
        return (
          <span
            key={`${part}-${occurrence}`}
            className="dlu-title-word"
            style={{ animationDelay: `${Math.min(index, 20) * WORD_DELAY_MS}ms` }}
          >
            {part}
          </span>
        );
      })}
    </Tag>
  );
}

/** Cycles the catalogue lines and replays the word animation. Reduced motion keeps the first line. */
export function RotatingTitle({
  as = 'h1',
  lines,
  className,
}: {
  as?: 'h1' | 'h2' | 'p';
  lines: readonly string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const safe = lines.filter((line) => line.trim().length > 0);

  const count = safe.length;
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, LINE_HOLD_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  const text = safe[index] ?? safe[0] ?? '';
  return <AnimatedTitle as={as} key={text} text={text} className={className} />;
}

'use client';

const WORD_DELAY_MS = 55;

type AnimatedTitleProps = {
  as?: 'h1' | 'h2';
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

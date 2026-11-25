'use client';

import { useState } from 'react';

/** Logo from the business's own site. A failed image falls back to an initial. */
export function BusinessLogo({
  src,
  fallback,
  className,
}: {
  src: string | null;
  fallback: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={`flex items-center justify-center bg-[#ece9e2] font-display text-sm text-foreground dark:bg-[#1a1a18] ${className}`}
      >
        {fallback.slice(0, 1)}
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: the mark is hosted on the business's own domain
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`bg-white object-contain p-1.5 ${className}`}
    />
  );
}

//
// Open Graph / Twitter image — the black DriveLinkUp logo on the light brand tone.
// Name + tagline come from `brandVisual.og` in src/lib/brand.ts.
import { ImageResponse } from 'next/og';
import { brandVisual, siteName } from '@/lib/brand';

export const alt = siteName;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LINK_D =
  'M-14.5 -3.8 h29 a5.3 5.3 0 0 1 0 10.6 h-29 a5.3 5.3 0 0 1 0 -10.6 z M-10.7 -2.65 h21.4 a2.65 2.65 0 0 1 0 5.3 h-21.4 a2.65 2.65 0 0 1 0 -5.3 z';

export default function OpengraphImage() {
  const { background, foreground, tagline } = brandVisual.og;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        color: foreground,
        padding: '0 80px',
        textAlign: 'center',
      }}
    >
      {/* Black logo mark — same geometry as /brand/logo-black.svg (flat fills for satori) */}
      <div
        style={{
          width: 168,
          height: 168,
          borderRadius: 36,
          background: '#0D1312',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
        }}
      >
        <svg aria-hidden="true" width="104" height="104" viewBox="-24 -24 48 48">
          <g transform="rotate(-45)" fill="#0E7C7B">
            <path fillRule="evenodd" d={LINK_D} />
          </g>
          <rect x="-3.9" y="-3.9" width="7.8" height="7.8" transform="rotate(45)" fill="#0D1312" />
          <g transform="rotate(45)" fill="#98D5C6">
            <path fillRule="evenodd" d={LINK_D} />
            <circle cx="0" cy="0" r="1.6" />
            <rect x="-0.55" y="-1.6" width="1.1" height="3.2" fill="#0D1312" />
          </g>
          <circle cx="0" cy="0" r="1.6" transform="rotate(-45)" fill="#00A884" />
          <rect
            x="-0.55"
            y="-1.6"
            width="1.1"
            height="3.2"
            transform="rotate(-45)"
            fill="#0D1312"
          />
        </svg>
      </div>
      <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {siteName}
      </div>
      {tagline ? (
        <div style={{ display: 'flex', marginTop: 24, fontSize: 40, opacity: 0.7 }}>{tagline}</div>
      ) : null}
    </div>,
    size,
  );
}

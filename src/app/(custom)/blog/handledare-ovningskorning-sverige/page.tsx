import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpatMoverGuide } from '@/components/custom/expat-mover-guide';
import { swedishCanonicalAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Handledare och övningskörning i Sverige',
  description:
    'Privat övningskörning kräver en handledare som Transportstyrelsen har godkänt för eleven. DriveLinkUp utfärdar inte det godkännandet.',
  alternates: swedishCanonicalAlternates('/blog/handledare-ovningskorning-sverige'),
};

export default function HandledareBlogPost() {
  return (
    <article className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <p className="text-eyebrow text-muted-foreground">Guide</p>
      <h1 className="font-display text-balance text-4xl font-semibold tracking-tight">
        Handledare och övningskörning i Sverige
      </h1>
      <p className="text-lg text-muted-foreground">
        Privat övningskörning kräver en handledare som Transportstyrelsen har godkänt för just den
        eleven. Det är inte ett föräldramedgivande, och DriveLinkUp utfärdar inte godkännandet.
      </p>
      <ExpatMoverGuide lang="sv" />
      <div className="grid gap-4 text-body text-foreground">
        <p>
          Eleven behöver ett giltigt körkortstillstånd. Personbil utan släp får övningsköras från 16
          år. Handledaren ska ha fyllt 24 år, ha giltigt körkort för fordonet och ha haft det i
          minst fem av de senaste tio åren. Från den 1 augusti 2026 krävs inte
          introduktionsutbildning för behörighet B.
        </p>
        <p>
          Letar du efter en trafikskola? Börja i{' '}
          <Link className="underline" href="/locations">
            katalogen
          </Link>{' '}
          eller läs mer på{' '}
          <Link className="underline" href="/handledare">
            handledare-sidan
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

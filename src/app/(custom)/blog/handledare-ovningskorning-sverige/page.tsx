import type { Metadata } from 'next';
import Link from 'next/link';
import { publicAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Handledare och övningskörning i Sverige — DriveLinkUp',
  description:
    'Så fungerar handledarskap för övningskörning, och hur DriveLinkUp kopplar 16–17-åringar till handledare innan bokning.',
  alternates: publicAlternates('/blog/handledare-ovningskorning-sverige'),
};

export default function HandledareBlogPost() {
  return (
    <article className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <p className="text-eyebrow text-muted-foreground">Guide</p>
      <h1 className="font-display text-balance text-4xl font-semibold tracking-tight">
        Handledare och övningskörning i Sverige
      </h1>
      <p className="text-lg text-muted-foreground">
        För elever mellan 16 och 17 år krävs handledarskap innan bokning på DriveLinkUp. Det är ett
        Trafikverket-orienterat handledarskap — inte ett generellt föräldramedgivande.
      </p>
      <div className="grid gap-4 text-body text-foreground">
        <p>
          Eleven verifierar ålder med ID via Didit. Om åldern är 16–17 skickas en inbjudan till
          handledaren, som godkänner via en unik länk. Först därefter blir kontot ACTIVE och kan
          boka lektioner.
        </p>
        <p>
          Letar du efter en körskola eller instruktör? Börja i{' '}
          <Link className="underline" href="/instructors">
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

'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

export function BookingMessagingEntry({ bookingId }: { bookingId: string }) {
  const t = useTranslations('messaging');
  const session = useSession();
  if (session.isPending || !session.data?.user) return null;
  return (
    <Button asChild type="button" size="sm" variant="outline" className="w-fit">
      <Link href={`/dashboard/messages?bookingId=${encodeURIComponent(bookingId)}`}>
        <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('title')}
      </Link>
    </Button>
  );
}

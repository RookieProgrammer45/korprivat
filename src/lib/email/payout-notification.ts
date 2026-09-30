import { renderEmail, type EmailContent } from '@/lib/email/templates';

/** Notify instructor or school that a Connect transfer was sent. */
export function payoutNotificationEmail(input: {
  locale: 'sv' | 'en';
  recipientName: string;
  amountSek: number;
  bookingId: string;
  learnerName: string;
}): EmailContent {
  const sv = input.locale !== 'en';
  const { html, text } = renderEmail({
    heading: sv ? 'Utbetalning skickad' : 'Payout sent',
    body: sv
      ? [
          `Hej ${input.recipientName},`,
          `Vi har skickat ${input.amountSek} kr till ditt Stripe-konto för lektionen med ${input.learnerName}.`,
          'Pengarna syns på ditt bankkonto enligt Stripe Connect-utbetalningschema.',
        ]
      : [
          `Hi ${input.recipientName},`,
          `We sent ${input.amountSek} SEK to your Stripe account for the lesson with ${input.learnerName}.`,
          'Funds appear on your bank account according to your Stripe Connect payout schedule.',
        ],
    footer: sv ? `Boknings-id: ${input.bookingId}` : `Booking ID: ${input.bookingId}`,
  });
  return {
    subject: sv ? 'Utbetalning skickad — DriveLinkUp' : 'Payout sent — DriveLinkUp',
    html,
    text,
  };
}

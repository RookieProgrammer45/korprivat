import { renderEmail, type EmailContent } from '@/lib/email/templates';

/** Notify learner that a Stripe refund was issued. */
export function refundNotificationEmail(input: {
  locale: 'sv' | 'en';
  recipientName: string;
  amountSek: number | null;
  bookingId: string;
}): EmailContent {
  const sv = input.locale !== 'en';
  const amountLine =
    input.amountSek != null
      ? sv
        ? `Återbetalningen är på ${input.amountSek} kr.`
        : `The refund amount is ${input.amountSek} SEK.`
      : sv
        ? 'Hela beloppet återbetalas till ditt kort.'
        : 'The full charge is being refunded to your card.';
  const { html, text } = renderEmail({
    heading: sv ? 'Återbetalning genomförd' : 'Refund processed',
    body: sv
      ? [
          `Hej ${input.recipientName},`,
          'Din bokning har avbokats och återbetalningen är skickad via Stripe.',
          amountLine,
          'Det kan ta några bankdagar innan beloppet syns på kontot.',
        ]
      : [
          `Hi ${input.recipientName},`,
          'Your booking was cancelled and the refund has been sent via Stripe.',
          amountLine,
          'It may take a few business days to appear on your statement.',
        ],
    footer: sv ? `Boknings-id: ${input.bookingId}` : `Booking ID: ${input.bookingId}`,
  });
  return {
    subject: sv ? 'Återbetalning — DriveLinkUp' : 'Refund — DriveLinkUp',
    html,
    text,
  };
}

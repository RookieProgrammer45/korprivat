import { renderEmail, type EmailContent } from '@/lib/email/templates';

/** Learner payment confirmation after checkout succeeds (held in escrow). */
export function paymentReceiptEmail(input: {
  locale: 'sv' | 'en';
  recipientName: string;
  instructorName: string;
  amountSek: number;
  bookingId: string;
  bookingUrl?: string;
}): EmailContent {
  const sv = input.locale !== 'en';
  const { html, text } = renderEmail({
    heading: sv ? 'Betalning mottagen' : 'Payment received',
    body: sv
      ? [
          `Hej ${input.recipientName},`,
          `Vi har mottagit din betalning på ${input.amountSek} kr för lektionen med ${input.instructorName}.`,
          'Beloppet hålls i escrow och släpps till instruktören eller skolan när lektionen är genomförd.',
        ]
      : [
          `Hi ${input.recipientName},`,
          `We received your payment of ${input.amountSek} SEK for the lesson with ${input.instructorName}.`,
          'Funds are held in escrow and released to the instructor or school when the lesson is completed.',
        ],
    cta: input.bookingUrl
      ? {
          label: sv ? 'Öppna bokningen' : 'Open booking',
          url: input.bookingUrl,
        }
      : undefined,
    footer: sv ? `Boknings-id: ${input.bookingId}` : `Booking ID: ${input.bookingId}`,
  });
  return {
    subject: sv ? 'Betalning mottagen — DriveLinkUp' : 'Payment received — DriveLinkUp',
    html,
    text,
  };
}

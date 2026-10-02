
import { type EmailContent, renderEmail } from '@/lib/email/templates';

/** Password-reset link after requestPasswordReset (1h expiry by default). */
export function resetPasswordEmail(input: {
  name?: string | null;
  resetUrl: string;
  locale?: 'sv' | 'en';
}): EmailContent {
  const locale = input.locale ?? 'sv';
  if (locale === 'en') {
    const { html, text } = renderEmail({
      heading: 'Reset your password',
      body: [
        input.name ? `Hi ${input.name},` : 'Hi,',
        'We received a request to reset your DriveLinkUp password. Use the button below — the link expires in 1 hour.',
        'If you did not ask for this, you can ignore this email. Your password stays the same.',
      ],
      cta: { label: 'Choose a new password', url: input.resetUrl },
      footer: 'DriveLinkUp · Sweden',
    });
    return {
      subject: 'Reset your password — DriveLinkUp',
      html,
      text,
    };
  }

  const { html, text } = renderEmail({
    heading: 'Återställ ditt lösenord',
    body: [
      input.name ? `Hej ${input.name},` : 'Hej,',
      'Vi fick en begäran om att återställa ditt DriveLinkUp-lösenord. Använd knappen nedan — länken gäller i 1 timme.',
      'Om du inte bad om detta kan du ignorera mejlet. Ditt lösenord ändras inte.',
    ],
    cta: { label: 'Välj nytt lösenord', url: input.resetUrl },
    footer: 'DriveLinkUp · Sverige',
  });
  return {
    subject: 'Återställ ditt lösenord — DriveLinkUp',
    html,
    text,
  };
}

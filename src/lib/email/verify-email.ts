
import { type EmailContent, renderEmail } from '@/lib/email/templates';

export function verifyEmailTemplate(input: {
  name?: string | null;
  verifyUrl: string;
  locale?: 'sv' | 'en';
}): EmailContent {
  const locale = input.locale ?? 'sv';
  if (locale === 'en') {
    const { html, text } = renderEmail({
      heading: 'Confirm your email',
      body: [
        input.name ? `Hi ${input.name},` : 'Hi,',
        'One last step before you start — confirm your email to activate your DriveLinkUp account.',
        'The link is valid for 24 hours.',
      ],
      cta: { label: 'Confirm email', url: input.verifyUrl },
      footer: 'DriveLinkUp · Sweden',
    });
    return {
      subject: 'Confirm your email — DriveLinkUp',
      html,
      text,
    };
  }

  const { html, text } = renderEmail({
    heading: 'Bekräfta din e-post',
    body: [
      input.name ? `Hej ${input.name},` : 'Hej,',
      'En sista sak innan du börjar — bekräfta din e-post för att aktivera ditt DriveLinkUp-konto.',
      'Länken gäller i 24 timmar.',
    ],
    cta: { label: 'Bekräfta e-post', url: input.verifyUrl },
    footer: 'DriveLinkUp · Sverige',
  });
  return {
    subject: 'Bekräfta din e-post — DriveLinkUp',
    html,
    text,
  };
}

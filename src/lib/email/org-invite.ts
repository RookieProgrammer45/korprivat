import { type EmailContent, renderEmail } from '@/lib/email/templates';

export function orgInviteEmail(input: {
  orgName: string;
  inviteUrl: string;
  locale?: 'sv' | 'en';
}): EmailContent {
  const locale = input.locale ?? 'sv';
  if (locale === 'en') {
    const { html, text } = renderEmail({
      heading: `You're invited to ${input.orgName}`,
      body: [
        'Hello,',
        `You've been invited to join ${input.orgName} as an instructor on DriveLinkUp.`,
        'Open the link below to accept. The invitation expires in 7 days.',
      ],
      cta: { label: 'Accept invitation', url: input.inviteUrl },
      footer: 'DriveLinkUp · Sweden',
    });
    return {
      subject: `Invitation to ${input.orgName} on DriveLinkUp`,
      html,
      text,
    };
  }

  const { html, text } = renderEmail({
    heading: `Du är inbjuden till ${input.orgName}`,
    body: [
      'Hej,',
      `Du har blivit inbjuden att gå med i ${input.orgName} som instruktör på DriveLinkUp.`,
      'Öppna länken nedan för att acceptera. Inbjudan gäller i 7 dagar.',
    ],
    cta: { label: 'Acceptera inbjudan', url: input.inviteUrl },
    footer: 'DriveLinkUp · Sverige',
  });
  return {
    subject: `Inbjudan till ${input.orgName} på DriveLinkUp`,
    html,
    text,
  };
}

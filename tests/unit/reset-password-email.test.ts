import { describe, expect, it } from 'vitest';
import { resetPasswordEmail } from '@/lib/email/reset-password';

describe('resetPasswordEmail', () => {
  it('renders Swedish subject and CTA by default', () => {
    const mail = resetPasswordEmail({
      name: 'Anna',
      resetUrl: 'https://www.drivelinkup.com/reset-password?token=abc',
    });
    expect(mail.subject).toContain('Återställ');
    expect(mail.html).toContain('https://www.drivelinkup.com/reset-password?token=abc');
    expect(mail.html).toContain('Välj nytt lösenord');
    expect(mail.text).toContain('Anna');
  });

  it('renders English when locale is en', () => {
    const mail = resetPasswordEmail({
      resetUrl: 'https://www.drivelinkup.com/reset-password?token=xyz',
      locale: 'en',
    });
    expect(mail.subject).toBe('Reset your password — DriveLinkUp');
    expect(mail.html).toContain('Choose a new password');
  });
});

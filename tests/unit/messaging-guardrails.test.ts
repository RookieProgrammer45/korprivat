import { describe, expect, it } from 'vitest';
import { classifyMessage } from '@/lib/business/messaging-guardrails';

describe('messaging guardrails', () => {
  it.each([
    'Can we meet at 14:30 outside the library?',
    'The B category lesson is 60 minutes and costs 550 SEK.',
    'Please bring your learner permit to the lesson.',
  ])('allows ordinary lesson logistics: %s', (message) => {
    expect(classifyMessage(message).blocked).toBe(false);
  });

  it.each([
    ['Call me on 070-123 45 67', 'phone'],
    ['Write to learner@example.com', 'email'],
    ['My Instagram: @drivecoach', 'social'],
    ['See https://example.com/details', 'external_link'],
    ['You can pay me directly with Swish', 'off_platform_payment'],
  ] as const)('blocks %s as %s', (message, category) => {
    const result = classifyMessage(message);
    expect(result.blocked).toBe(true);
    expect(result.categories).toContain(category);
  });

  it('returns a typed on-platform alternative for blocked content', () => {
    expect(classifyMessage('my email is test@example.com')).toMatchObject({
      explanationKey: 'blocked',
      alternativeKey: 'keep_on_platform',
    });
  });
});

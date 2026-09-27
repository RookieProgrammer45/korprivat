//
// The `@/lib/email/send` module is imported statically by every handler
// test at module-evaluation time. Register vi.mock at module-load so vitest
// hoists it above the test file's route-handler import. Mock fns are
// obtained via vi.hoisted so the factory closure can refer to them.
//
// Usage:
//   import './_setup/email-mock';
//   import { sendEmailMock, emailCalls, resetEmailMock } from './_setup/email-mock';
//   ...import route handlers here, after mocks...
//   beforeEach(() => resetEmailMock());
//   expect(sendEmailMock).toHaveBeenCalledTimes(2);
//
// biome: this file is OUTSIDE the overrides' src/** glob so biome's default
// rule set applies; we never import restricted paths here.

import { vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  // Plain vi.fn() without an explicit implementation — the route handlers
  // are responsible for calling `mockResolvedValueOnce({ id: ... })` per
  // case via the helpers below. We deliberately DO NOT call
  // `mockImplementation` here: that triggers TS's NormalizedProcedure
  // arity check, which then demands a different runtime signature and
  // explodes when the route handler invokes `sendEmail({to, subject, ...})`.
  const sendEmail = vi.fn();
  const calls: Array<{
    to: string;
    subject: string;
    text?: string;
    html?: string;
    replyToEmailId?: string;
  }> = [];
  return { sendEmail, calls };
});

vi.mock('@/lib/email/send', () => ({
  sendEmail: hoisted.sendEmail,
}));

export const sendEmailMock = hoisted.sendEmail;
export const emailCalls = hoisted.calls;

/**
 * Re-install a default implementation that records every call and returns
 * a synthetic id. Tests that need per-case behaviour (e.g. an injected
 * reject on the teacher email) override with `mockRejectedValueOnce` on
 * `sendEmailMock` BEFORE invoking the route handler.
 */
export function resetEmailMock(): void {
  hoisted.calls.length = 0;
  hoisted.sendEmail.mockReset();
  hoisted.sendEmail.mockImplementation(async (...args: unknown[]) => {
    const input = (args[0] ?? {}) as {
      to: string;
      subject: string;
      text?: string;
      html?: string;
      replyToEmailId?: string;
    };
    hoisted.calls.push({ ...input });
    return { id: `mock_email_${hoisted.calls.length}` };
  });
}

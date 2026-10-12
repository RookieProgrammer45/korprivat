import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  formValues: { email: 'learner@example.test', password: 'new-password', confirm: 'new-password' },
  submitHandlers: [] as Array<(values: Record<string, string>) => Promise<void>>,
  signInEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/lib/auth-client', () => ({
  signIn: { email: mocks.signInEmail },
  requestPasswordReset: mocks.requestPasswordReset,
  resetPassword: mocks.resetPassword,
}));
vi.mock('@/lib/forms', () => ({ applyServerErrors: vi.fn(() => false) }));
vi.mock('@/components/custom/social-auth-buttons', () => ({
  SocialAuthButtons: () => <div data-social-auth />,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode; disabled?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: ReactNode }) => <>{children}</>,
  FormControl: ({ children }: { children: ReactNode }) => <>{children}</>,
  FormField: ({ render }: { render: (props: { field: Record<string, never> }) => ReactNode }) => (
    <>{render({ field: {} })}</>
  ),
  FormItem: ({ children }: { children: ReactNode }) => <>{children}</>,
  FormLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  FormMessage: () => null,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    setError: vi.fn(),
    formState: { isSubmitting: false, errors: {} },
    handleSubmit:
      (callback: (values: Record<string, string>) => Promise<void>) =>
      async (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        mocks.submitHandlers.push(callback);
        await callback(mocks.formValues);
      },
  }),
}));

import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';
import { ResetPasswordForm } from '@/components/custom/reset-password-form';
import { SignInForm } from '@/components/custom/sign-in-form';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.submitHandlers.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL('https://app.example.test/forgot-password'),
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function submitRenderedForm(): Promise<void> {
  const form = container.querySelector('form');
  expect(form).not.toBeNull();
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('account recovery transport rejections', () => {
  it('shows a localized sign-in error and re-enables submission when signIn rejects', async () => {
    mocks.signInEmail.mockRejectedValueOnce(new Error('network down'));
    await act(async () => root.render(<SignInForm next="/dashboard/student/bookings" />));

    await submitRenderedForm();

    expect(mocks.toastError).toHaveBeenCalledWith('errors.generic');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      (container.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.disabled,
    ).toBe(false);
  });

  it('shows a localized retry error and remains on the form when the reset request rejects', async () => {
    mocks.requestPasswordReset.mockRejectedValueOnce(new Error('network down'));
    await act(async () => root.render(<ForgotPasswordForm next="/dashboard/student/bookings" />));

    await submitRenderedForm();

    expect(mocks.toastError).toHaveBeenCalledWith('errors.generic');
    expect(container.textContent).not.toContain('sentBody');
    expect(
      (container.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.disabled,
    ).toBe(false);
  });

  it('shows a localized reset error, re-enables submission, and does not navigate when reset rejects', async () => {
    mocks.resetPassword.mockRejectedValueOnce(new Error('network down'));
    await act(async () =>
      root.render(
        <ResetPasswordForm token="valid_reset_token" next="/dashboard/student/bookings" />,
      ),
    );

    await submitRenderedForm();

    expect(mocks.toastError).toHaveBeenCalledWith('errors.generic');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      (container.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.disabled,
    ).toBe(false);
  });
});

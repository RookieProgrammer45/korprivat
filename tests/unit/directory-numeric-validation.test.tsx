import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { mockApiFetch, mockReplace, mockSearchParams } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/instructors',
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/hooks/use-user-location', () => ({
  useUserLocation: () => ({ status: 'idle', coords: null, request: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/lib/api-client', () => ({ apiFetch: mockApiFetch }));
vi.mock('@/components/custom/provider-comparison', () => ({
  MAX_COMPARISON_ITEMS: 3,
  ProviderComparison: () => null,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className: _className,
    size: _size,
    variant: _variant,
    ...props
  }: ComponentProps<'button'> & { size?: string; variant?: string }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: ComponentProps<'input'>) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: () => null,
}));
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => <div /> }));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    onCheckedChange,
    checked,
    ...props
  }: ComponentProps<'input'> & { onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      {...props}
    />
  ),
}));

import { InstructorDirectory } from '@/components/custom/instructor-directory';

async function changeNumber(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('InstructorDirectory numeric validation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ items: [], cities: ['Stockholm'] });
    mockReplace.mockReset();
    mockSearchParams.set('lat', '59.3293');
    mockSearchParams.set('lng', '18.0686');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<InstructorDirectory />);
      await Promise.resolve();
    });
    mockApiFetch.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    mockSearchParams.delete('lat');
    mockSearchParams.delete('lng');
    vi.restoreAllMocks();
  });

  it.each([
    ['0', 'min-rate-input', 'min-rate-error'],
    ['-1', 'min-rate-input', 'min-rate-error'],
    ['20001', 'near-km-input', 'near-km-error'],
  ])(
    'keeps %s inline on %s without fetching a broad directory query',
    async (value, inputId, errorId) => {
      const input = container.querySelector<HTMLInputElement>(`#${inputId}`);
      expect(input).not.toBeNull();

      await changeNumber(input as HTMLInputElement, value);

      expect(container.querySelector(`#${errorId}`)).not.toBeNull();
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(container.querySelector('.directory-error-state')).toBeNull();
    },
  );
});

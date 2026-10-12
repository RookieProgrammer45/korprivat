import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagingWorkspace } from '@/components/custom/messaging/messaging-workspace';
import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
} from '@/lib/contracts/messaging';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const shared = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  sentCallbacks: new Map<string, (conversationId: string, message: ConversationMessage) => void>(),
}));

vi.mock('@/lib/api-client', () => ({ apiFetch: shared.apiFetch }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/custom/messaging/conversation-list', () => ({
  ConversationList: ({
    items,
    selectedId,
    onSelect,
  }: {
    items: ConversationSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          data-conversation-id={item.id}
          data-selected={String(selectedId === item.id)}
          onClick={() => onSelect(item.id)}
        >
          {item.id}:{item.lastMessage?.body ?? 'none'}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/custom/messaging/conversation-thread', () => ({
  ConversationThread: ({
    detail,
    onSent,
  }: {
    detail: ConversationDetail;
    onSent: (conversationId: string, message: ConversationMessage) => void;
  }) => {
    shared.sentCallbacks.set(detail.conversation.id, onSent);
    return <p data-thread-id={detail.conversation.id}>thread:{detail.conversation.id}</p>;
  },
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const timestamp = '2030-01-15T10:00:00.000Z';

function summary(id: string, body = `old-${id}`): ConversationSummary {
  return {
    id,
    booking: {
      bookingId: `booking-${id}`,
      instructorId: 'instructor-1',
      learnerName: 'Learner',
      instructorName: 'Instructor',
      category: 'B',
      scheduledAt: timestamp,
      durationMinutes: 60,
    },
    role: 'learner',
    otherParticipantName: `Participant ${id}`,
    unreadCount: 0,
    lastMessage: {
      id: `old-message-${id}`,
      senderId: 'other',
      senderName: 'Other',
      body,
      createdAt: timestamp,
      isMine: false,
    },
    lastMessageAt: timestamp,
  };
}

function detail(id: string): ConversationDetail {
  return { conversation: summary(id), messages: [] };
}

function sentMessage(id: string, body: string): ConversationMessage {
  return {
    id,
    senderId: 'me',
    senderName: 'Me',
    body,
    createdAt: '2030-01-15T10:01:00.000Z',
    isMine: true,
  };
}

async function waitFor(assertion: () => void): Promise<void> {
  await vi.waitFor(assertion, { timeout: 1_000, interval: 5 });
}

describe('messaging workspace reliability regressions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    shared.apiFetch.mockReset();
    shared.sentCallbacks.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('reissues the failed conversation-list request when Retry is clicked', async () => {
    shared.apiFetch.mockRejectedValueOnce(new Error('temporary list failure'));
    shared.apiFetch.mockResolvedValueOnce({ items: [] });

    await act(async () => root.render(<MessagingWorkspace />));
    await waitFor(() => expect(container.textContent).toContain('errorTitle'));
    expect(shared.apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      container.querySelector('button')?.click();
    });

    await waitFor(() => expect(shared.apiFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.textContent).toContain('emptyTitle'));
  });

  it('keeps the most recently selected thread when an older detail request resolves last', async () => {
    const a = deferred<ConversationDetail>();
    const b = deferred<ConversationDetail>();
    shared.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/conversations')
        return Promise.resolve({ items: [summary('a'), summary('b')] });
      if (url === '/api/conversations/a') return a.promise;
      if (url === '/api/conversations/b') return b.promise;
      throw new Error(`unexpected URL ${url}`);
    });

    await act(async () => root.render(<MessagingWorkspace />));
    await waitFor(() =>
      expect(shared.apiFetch).toHaveBeenCalledWith('/api/conversations/a', expect.anything()),
    );

    await act(async () => {
      (container.querySelector('[data-conversation-id="b"]') as HTMLButtonElement).click();
    });
    await waitFor(() =>
      expect(shared.apiFetch).toHaveBeenCalledWith('/api/conversations/b', expect.anything()),
    );

    await act(async () => b.resolve(detail('b')));
    await waitFor(() => expect(container.querySelector('[data-thread-id="b"]')).not.toBeNull());

    await act(async () => a.resolve(detail('a')));
    await waitFor(() => expect(container.querySelector('[data-thread-id="b"]')).not.toBeNull());
    expect(container.querySelector('[data-thread-id="a"]')).toBeNull();
    expect(
      container.querySelector('[data-conversation-id="b"]')?.getAttribute('data-selected'),
    ).toBe('true');
  });

  it('uses the delayed sender identity instead of the current selection for sent-message updates', async () => {
    const a = deferred<ConversationDetail>();
    const b = deferred<ConversationDetail>();
    shared.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/conversations')
        return Promise.resolve({ items: [summary('a'), summary('b')] });
      if (url === '/api/conversations/a') return a.promise;
      if (url === '/api/conversations/b') return b.promise;
      throw new Error(`unexpected URL ${url}`);
    });

    await act(async () => root.render(<MessagingWorkspace />));
    await waitFor(() =>
      expect(shared.apiFetch).toHaveBeenCalledWith('/api/conversations/a', expect.anything()),
    );
    await act(async () => a.resolve(detail('a')));
    await waitFor(() => expect(container.querySelector('[data-thread-id="a"]')).not.toBeNull());

    await act(async () => {
      (container.querySelector('[data-conversation-id="b"]') as HTMLButtonElement).click();
    });
    await waitFor(() =>
      expect(shared.apiFetch).toHaveBeenCalledWith('/api/conversations/b', expect.anything()),
    );
    await act(async () => b.resolve(detail('b')));
    await waitFor(() => expect(container.querySelector('[data-thread-id="b"]')).not.toBeNull());

    await act(async () => {
      shared.sentCallbacks.get('a')?.('a', sentMessage('delayed-a', 'sent-from-a'));
    });

    expect(container.querySelector('[data-conversation-id="a"]')?.textContent).toContain(
      'sent-from-a',
    );
    expect(container.querySelector('[data-conversation-id="b"]')?.textContent).toContain('old-b');
    expect(container.querySelector('[data-thread-id="b"]')).not.toBeNull();
  });
});

// @polsia:user-owned — authorization and persistence-boundary coverage.
import './_setup/env';
import './_setup/auth-mock';
import { vi } from 'vitest';
import { prismaMock, resetPrisma } from './_setup/prisma-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { beforeEach, describe, expect, it } from 'vitest';
import { POST as messagesPOST } from '@/app/api/conversations/[id]/messages/route';
import { POST as reportPOST } from '@/app/api/conversations/[id]/report/route';
import { GET as conversationsGET, POST as conversationsPOST } from '@/app/api/conversations/route';
import { authMock } from './_setup/auth-mock';

function request(url: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  resetPrisma();
  authMock.reset();
});

describe('messaging authorization', () => {
  it('rejects unauthenticated conversation lists', async () => {
    const response = await conversationsGET(request('/api/conversations'));
    expect(response.status).toBe(401);
  });

  it('does not let a non-participant read a thread', async () => {
    authMock.setUser({ id: 'outsider', email: 'outsider@example.test' });
    prismaMock.conversationParticipant.findUnique.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/conversations/[id]/route');
    const response = await GET(request('/api/conversations/private'), {
      params: Promise.resolve({ id: 'private' }),
    });
    expect(response.status).toBe(404);
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled();
  });

  it('rejects legacy anonymous bookings when opening a conversation', async () => {
    authMock.setUser({ id: 'learner', email: 'learner@example.test' });
    prismaMock.booking.findUnique.mockResolvedValueOnce({
      id: 'booking_legacy',
      instructorId: 'instructor_1',
      userId: null,
    });
    const response = await conversationsPOST(
      request('/api/conversations', { bookingId: 'booking_legacy' }),
    );
    expect(response.status).toBe(403);
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it('returns blocked content without persisting a message', async () => {
    authMock.setUser({ id: 'learner', email: 'learner@example.test' });
    prismaMock.conversationParticipant.findUnique.mockResolvedValueOnce({
      id: 'participant_1',
      userId: 'learner',
      role: 'learner',
      lastReadAt: null,
    });
    const response = await messagesPOST(
      request('/api/conversations/c_1/messages', {
        body: 'Call me on 070-123 45 67',
      }),
      {
        params: Promise.resolve({ id: 'c_1' }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'blocked',
      categories: ['phone'],
    });
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('does not let a non-participant file a report', async () => {
    authMock.setUser({ id: 'outsider', email: 'outsider@example.test' });
    prismaMock.conversationParticipant.findUnique.mockResolvedValueOnce(null);
    const response = await reportPOST(
      request('/api/conversations/private/report', {
        reason: 'safety',
      }),
      { params: Promise.resolve({ id: 'private' }) },
    );
    expect(response.status).toBe(404);
    expect(prismaMock.messageReport.create).not.toHaveBeenCalled();
  });
});

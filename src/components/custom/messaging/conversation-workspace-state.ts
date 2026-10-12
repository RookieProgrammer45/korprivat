import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
} from '@/lib/contracts/messaging';

export type ConversationDetailRequest = {
  conversationId: string;
  token: number;
};

export function createConversationDetailRequestGuard() {
  let latestToken = 0;

  return {
    start(conversationId: string): ConversationDetailRequest {
      latestToken += 1;
      return { conversationId, token: latestToken };
    },
    isCurrent(request: ConversationDetailRequest): boolean {
      return request.token === latestToken;
    },
    invalidate(): void {
      latestToken += 1;
    },
  };
}

export function appendSentMessage(
  detail: ConversationDetail | null,
  conversationId: string,
  message: ConversationMessage,
): ConversationDetail | null {
  if (!detail || detail.conversation.id !== conversationId) return detail;
  return { ...detail, messages: [...detail.messages, message] };
}

export function updateConversationSummaryForSentMessage(
  items: ConversationSummary[],
  conversationId: string,
  message: ConversationMessage,
): ConversationSummary[] {
  return items.map((item) =>
    item.id === conversationId
      ? {
          ...item,
          lastMessage: message,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
        }
      : item,
  );
}

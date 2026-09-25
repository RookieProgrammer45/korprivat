// @polsia:user-owned — shared contract for booking-scoped messaging.
import { z } from 'zod';

export const MessagingCategoryCode = z.enum([
  'phone',
  'email',
  'social',
  'external_link',
  'off_platform_payment',
]);
export type MessagingCategoryCode = z.infer<typeof MessagingCategoryCode>;

export const MessagingRole = z.enum(['learner', 'instructor']);
export type MessagingRole = z.infer<typeof MessagingRole>;

export const BookingContext = z.object({
  bookingId: z.string(),
  instructorId: z.string(),
  learnerName: z.string(),
  instructorName: z.string(),
  category: z.string(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
});
export type BookingContext = z.infer<typeof BookingContext>;

export const ConversationMessage = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  body: z.string().max(2000),
  createdAt: z.string().datetime(),
  isMine: z.boolean(),
});
export type ConversationMessage = z.infer<typeof ConversationMessage>;

export const ConversationSummary = z.object({
  id: z.string(),
  booking: BookingContext,
  role: MessagingRole,
  otherParticipantName: z.string(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: ConversationMessage.nullable(),
  lastMessageAt: z.string().datetime().nullable(),
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

export const ConversationList = z.object({
  items: z.array(ConversationSummary),
});
export type ConversationList = z.infer<typeof ConversationList>;

export const ConversationDetail = z.object({
  conversation: ConversationSummary,
  messages: z.array(ConversationMessage),
});
export type ConversationDetail = z.infer<typeof ConversationDetail>;

export const CreateConversationInput = z.object({
  bookingId: z.string().trim().min(1),
});
export const CreateConversationResult = z.object({
  conversation: ConversationSummary,
});
export type CreateConversationInput = z.infer<typeof CreateConversationInput>;
export type CreateConversationResult = z.infer<typeof CreateConversationResult>;

export const MessageInput = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type MessageInput = z.infer<typeof MessageInput>;

export const SentMessageResponse = z.object({
  status: z.literal('sent'),
  message: ConversationMessage,
});
export const BlockedMessageResponse = z.object({
  status: z.literal('blocked'),
  categories: z.array(MessagingCategoryCode).min(1),
  alternative: z.literal('keep_on_platform'),
});
export const SendMessageResponse = z.discriminatedUnion('status', [
  SentMessageResponse,
  BlockedMessageResponse,
]);
export type SendMessageResponse = z.infer<typeof SendMessageResponse>;

export const ReadResponse = z.object({
  readAt: z.string().datetime(),
});
export type ReadResponse = z.infer<typeof ReadResponse>;

export const MessageReportReason = z.enum([
  'safety',
  'harassment',
  'off_platform_request',
  'other',
]);
export type MessageReportReason = z.infer<typeof MessageReportReason>;
export const MessageReportInput = z.object({
  messageId: z.string().min(1).optional(),
  reason: MessageReportReason,
  details: z.string().trim().max(500).optional(),
});
export type MessageReportInput = z.infer<typeof MessageReportInput>;
export const MessageReportResult = z.object({
  status: z.literal('reported'),
});
export type MessageReportResult = z.infer<typeof MessageReportResult>;

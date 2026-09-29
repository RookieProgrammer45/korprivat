//
// Server-only OpenAI helpers. Chatbot + generateObject recommendations call
// the public OpenAI API directly with OPENAI_API_KEY.

import 'server-only';
import OpenAI from 'openai';
import type { ChatMessage } from '@/lib/ai/schema';

export class AiConfigurationError extends Error {
  constructor(message = 'AI is not configured for this app.') {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_VISION_MODEL = 'gpt-4o';

// Vision messages carry an array content part; the public chat contract
// (ChatMessage) is text-only. This broader type is used internally only.
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };
export type LlmMessage = ChatMessage | { role: ChatMessage['role']; content: ContentPart[] };

export interface ChatOptions {
  messages: LlmMessage[];
  model?: string;
  task?: string;
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
  signal?: AbortSignal;
}

function openaiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiConfigurationError(
      'OPENAI_API_KEY is missing. Set it in .env.local / Vercel env.',
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
  });
}

function toOpenAiMessages(messages: LlmMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages as OpenAI.Chat.ChatCompletionMessageParam[];
}

/** Non-streaming chat completion. Returns the assistant message text. */
export async function chat(opts: ChatOptions): Promise<string> {
  const client = openaiClient();
  const completion = await client.chat.completions.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages: toOpenAiMessages(opts.messages),
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(opts.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    },
    opts.signal ? { signal: opts.signal } : undefined,
  );
  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Streaming chat completion. Returns a Response with an OpenAI-compatible
 * SSE body so route handlers can relay tokens to the browser unchanged.
 */
export async function streamChat(opts: ChatOptions): Promise<Response> {
  const client = openaiClient();
  const stream = await client.chat.completions.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages: toOpenAiMessages(opts.messages),
      stream: true,
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(opts.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    },
    opts.signal ? { signal: opts.signal } : undefined,
  );

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

/**
 * Structured JSON output. Forces `response_format: json_object`, parses the
 * result, and retries once with a stricter instruction on a parse failure.
 */
export async function generateObject<T = unknown>(opts: ChatOptions): Promise<T> {
  const raw = await chat({ ...opts, responseFormat: 'json_object' });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const retry = await chat({
      ...opts,
      responseFormat: 'json_object',
      messages: [
        ...opts.messages,
        { role: 'system', content: 'Respond with valid JSON only. No prose, no markdown fences.' },
      ],
    });
    return JSON.parse(retry) as T;
  }
}

export interface AnalyzeImageOptions {
  imageUrl: string;
  prompt: string;
  model?: string;
  task?: string;
  json?: boolean;
}

/** Vision: analyze an image URL against a prompt. */
export async function analyzeImage(opts: AnalyzeImageOptions): Promise<string> {
  return chat({
    model: opts.model ?? DEFAULT_VISION_MODEL,
    task: opts.task,
    responseFormat: opts.json ? 'json_object' : 'text',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: opts.prompt },
          { type: 'image_url', image_url: { url: opts.imageUrl, detail: 'high' } },
        ],
      },
    ],
  });
}

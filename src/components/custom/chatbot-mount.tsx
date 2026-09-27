//
// Single client island, mounted once at the app root by global-mounts.tsx
// (which the framework-owned layout.tsx renders once). Lives next to the
// toast host and the existing SiteNav, so it shows on every public page and
// doesn't need per-page wiring.
//
// UX:
//   - Floating action button (FAB) anchored bottom-right; brand-tinted,
//     lucide MessageCircle icon. Opens the chat surface.
//   - Surface uses Radix <Sheet> on viewports < md (slides up from bottom)
//     and <Dialog> on >= md (centered card). One component, two primitives
//     driven by a matchMedia listener — switching is transparent to the user.
//   - Inside: localized title/lead copy, message transcript, input form with
//     a send button, and a "Still need help? Talk to the team" CTA when the
//     bot hands off (the resolved CONTACT_TOPIC alias navigates to
//     /contact?topic=<alias>; the existing <ContactFlow/> picks the tile).
//
// Data plane:
//   - Posts every message to /api/chatbot through `apiFetch` + the shared
//     zod contract (`chatbotMessageResponseSchema`) so the typed response is
//     runtime-validated. No raw @anthropic-ai/sdk here; the route handler
//     round-trips through the platform AI proxy via @/lib/ai/client#chat.
//   - conversationId is generated on first send and sent back so the server
//     can group follow-ups; the route handler accepts it as optional input
//     and mints a new UUID on the first turn — server is stateless either
//     way, and this stays a UI nicety for "one human-thread per bot-thread".
//   - Locale is read from useLocale() so the assistant gets the visitor's
//     active language and the response envelope drives the handoff CTA.
//
// Why NOT <AiChat/>:
//   The `ai` module ships <AiChat/>, which streams SSE through
//   /api/ai/chat. That surface is great for free-form chat, but it does not
//   return a structured `suggestContactTopic` / `conversationId` envelope
//   the way this brief needs (the bot's "Talk to the team" CTA depends on
//   the server knowing the topic the LLM chose). So this island uses the
//   dedicated /api/chatbot route + contract instead.

'use client';

import { Loader2, MessageCircle, SendHorizontal, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiFetch } from '@/lib/api-client';
import { resolveContactTopic } from '@/lib/contact/schema';
import { chatbotMessageResponseSchema, chatbotMessageSendSchema } from '@/lib/contracts/chatbot';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestContactTopic?: string | null;
}

function newId(): string {
  return crypto.randomUUID();
}

const DESKTOP_QUERY = '(min-width: 768px)';

interface SurfaceStrings {
  title: string;
  lead: string;
  closeAria: string;
  placeholder: string;
  inputAria: string;
  sendAria: string;
  emptyState: string;
}

interface SurfaceBinding {
  strings: SurfaceStrings;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turns: ChatTurn[];
  pending: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onAsk: (text: string) => void;
  latestNodeRef: React.RefCallback<HTMLDivElement | null>;
}

export function ChatbotMount() {
  const t = useTranslations('chatbot');
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const conversationIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const apply = () => setIsDesktop(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  // Auto-scroll: a callback ref on the FINAL bubble in the transcript fires
  // every time a new node mounts (i.e. a new turn). `scrollIntoView` lives
  // on the node callback so we don't need an effect + exhaustive deps.
  const latestNodeRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ block: 'end' });
  }, []);

  const ask = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      const userTurn: ChatTurn = { id: newId(), role: 'user', content: trimmed };
      setTurns((prev) => [...prev, userTurn]);
      setInput('');
      setPending(true);
      try {
        const payload = chatbotMessageSendSchema.parse({
          message: trimmed,
          locale,
          conversationId: conversationIdRef.current ?? undefined,
        });
        const response = await apiFetch('/api/chatbot', {
          method: 'POST',
          body: JSON.stringify(payload),
          schema: chatbotMessageResponseSchema,
        });
        conversationIdRef.current = response.conversationId;
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: response.reply,
            suggestContactTopic: response.suggestContactTopic,
          },
        ]);
      } catch (err) {
        // apiFetch surfaces the upstream status in the thrown message ("…
        // failed (429)"); regex it out so 429 gets a specific error toast
        // and any other failure falls back to the generic copy.
        const message = err instanceof Error ? err.message : '';
        const match = message.match(/failed \((\d+)\)/);
        const status = match ? Number(match[1]) : undefined;
        if (status === 429) {
          toast.error(t('rateLimited'));
        } else {
          toast.error(t('errorGeneric'));
        }
        setTurns((prev) => prev.filter((prevTurn) => prevTurn.id !== userTurn.id));
      } finally {
        setPending(false);
      }
    },
    [locale, pending, t],
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void ask(input);
  };

  const strings: SurfaceStrings = {
    title: t('title'),
    lead: t('lead'),
    closeAria: t('closeAria'),
    placeholder: t('placeholder'),
    inputAria: t('inputAria'),
    sendAria: t('sendAria'),
    emptyState: t('emptyState'),
  };

  const binding: SurfaceBinding = {
    strings,
    open,
    onOpenChange: setOpen,
    turns,
    pending,
    input,
    onInputChange: setInput,
    onSubmit,
    onAsk: ask,
    latestNodeRef,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('fabLabel')}
        className="chatbot-fab fixed bottom-5 right-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 md:bottom-7 md:right-7"
      >
        <MessageCircle className="size-6" aria-hidden />
      </button>
      {isDesktop ? <DesktopSurface {...binding} /> : <MobileSurface {...binding} />}
    </>
  );
}

function DesktopSurface(props: SurfaceBinding) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="surface-panel flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card p-0 shadow-lg"
      >
        <DialogTitle className="sr-only">{props.strings.title}</DialogTitle>
        <DialogDescription className="sr-only">{props.strings.lead}</DialogDescription>
        <BrandHeader title={props.strings.title} lead={props.strings.lead} />
        <DialogClose
          aria-label={props.strings.closeAria}
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X className="size-4" aria-hidden />
        </DialogClose>
        <Canvas {...props} />
      </DialogContent>
    </Dialog>
  );
}

function MobileSurface(props: SurfaceBinding) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="surface-panel flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-b-0 border-l-0 border-r-0 border-t border-border bg-card p-0 shadow-lg"
      >
        <SheetTitle className="sr-only">{props.strings.title}</SheetTitle>
        <SheetDescription className="sr-only">{props.strings.lead}</SheetDescription>
        <BrandHeader title={props.strings.title} lead={props.strings.lead} />
        <SheetClose
          aria-label={props.strings.closeAria}
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X className="size-4" aria-hidden />
        </SheetClose>
        <Canvas {...props} />
      </SheetContent>
    </Sheet>
  );
}

function BrandHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-brand-700 bg-primary px-5 py-4 pr-14 text-primary-foreground">
      <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
        <Sparkles className="size-4" aria-hidden />
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-h4 leading-tight tracking-tight text-primary-foreground">{title}</h2>
        <p className="text-small text-primary-foreground/85">{lead}</p>
      </div>
    </div>
  );
}

// Transcript + composer — identical in both surfaces so they live in a single
// component. The transcript auto-scrolls to the latest node via a callback
// ref: whichever bubble (the last in `turns`) or pending indicator mounts
// last gets the ref, so the scroll target moves to the bottom on every turn.
function Canvas(props: SurfaceBinding) {
  const lastTurnIndex = props.turns.length - 1;
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background px-4 py-4">
        {props.turns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-small text-muted-foreground">
            <p>{props.strings.emptyState}</p>
          </div>
        ) : (
          props.turns.map((turn, index) => (
            <React.Fragment key={turn.id}>
              <Bubble
                role={turn.role}
                content={turn.content}
                nodeRef={
                  index === lastTurnIndex && !props.pending ? props.latestNodeRef : undefined
                }
              />
              {turn.role === 'assistant' && turn.suggestContactTopic ? (
                <HandoffCta topic={turn.suggestContactTopic} />
              ) : null}
            </React.Fragment>
          ))
        )}
        {props.pending ? (
          <div ref={props.latestNodeRef} className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-md border border-border bg-muted px-3.5 py-2 text-small text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />…
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={props.onSubmit}
        className="flex items-end gap-2 border-t border-border bg-card px-4 py-3"
        noValidate
      >
        <label htmlFor="chatbot-input" className="sr-only">
          {props.strings.inputAria}
        </label>
        <textarea
          id="chatbot-input"
          value={props.input}
          onChange={(e) => props.onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              props.onAsk(props.input);
            }
          }}
          rows={1}
          placeholder={props.strings.placeholder}
          aria-label={props.strings.inputAria}
          disabled={props.pending}
          className="min-h-10 max-h-32 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-small shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          size="icon"
          disabled={props.pending || !props.input.trim()}
          aria-label={props.strings.sendAria}
        >
          <SendHorizontal className="size-4" aria-hidden />
        </Button>
      </form>
    </>
  );
}

function Bubble({
  role,
  content,
  nodeRef,
}: {
  role: 'user' | 'assistant';
  content: string;
  nodeRef?: React.Ref<HTMLDivElement>;
}) {
  const isUser = role === 'user';
  return (
    <div ref={nodeRef} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-small text-primary-foreground shadow-sm'
            : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-muted px-3.5 py-2 text-small text-foreground'
        }
      >
        {content || '…'}
      </div>
    </div>
  );
}

function HandoffCta({ topic }: { topic: string }) {
  const t = useTranslations('chatbot');
  const resolved = resolveContactTopic(topic);
  const href = resolved ? `/contact?topic=${encodeURIComponent(resolved)}` : '/contact';
  return (
    <div className="mt-2 flex min-w-0 justify-start">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-auto max-w-full min-w-0 whitespace-normal rounded-md border border-brand-500/30 bg-brand-100 px-3 py-1.5 text-left text-small font-medium text-brand-700 transition-colors hover:bg-brand-200 hover:text-brand-700 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-800 dark:hover:text-brand-200"
      >
        <Link href={href}>
          <span className="min-w-0 break-words">{t('handoffLabel')}</span>
        </Link>
      </Button>
    </div>
  );
}

// @polsia:user-owned — guided Contact flow island.
//
// Two-step marketplace support pattern:
//   Step 1 — eyebrow + heading + lead + a grid of brand-tinted topic tiles
//            rendered as a <RadioGroup/> of `<Card>`-styled tiles. Picking
//            a tile transitions to step 2.
//   Step 2 — single column form (name / email / message) with a retro-link
//            to step 1 ("choose a different topic"). Submit POSTs to
//            /api/contact via `apiFetch` with the shared zod contract.
//
// The hero copy reads from `landing.contactPage.*` via `useTranslations` so
// SV / EN resolve from the active locale cookie. The validated zod schema
// is the source of truth for the topic enum, so the same string array the
// server enforces is what the tiles render — typo-proof by construction.
//
// Only ONE step is in the document at a time — the inactive step is removed
// from layout rather than absolutely positioned over the active one, so on
// narrow viewports the form never bleeds outside its container.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Mail, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  CONTACT_TOPICS,
  type ContactInquiryCreate,
  type ContactTopic,
  contactInquiryCreatedSchema,
  contactInquiryCreateSchema,
} from '@/lib/contact/schema';
import { applyServerErrors } from '@/lib/forms';

export interface ContactFlowProps {
  /**
   * Optional initial topic — drives the deep-link `/contact?topic=cancellation`
   * from the FAQ. Validated through `resolveContactTopic` server-side so an
   * invalid alias silently falls back to no preselection (step 1).
   */
  initialTopic?: ContactTopic | null;
}

interface TopicDef {
  value: ContactTopic;
  index: number;
}

const TOPIC_DEFS: TopicDef[] = CONTACT_TOPICS.map((value, index) => ({ value, index }));

export function ContactFlow({ initialTopic = null }: ContactFlowProps) {
  const t = useTranslations('landing.contactPage');
  const tFields = useTranslations('landing.contactPage.fields');
  const tTopics = useTranslations('landing.contactPage.topics');
  const tStep = useTranslations('landing.contactPage.step');
  const locale = useLocale();

  const [selectedTopic, setSelectedTopic] = React.useState<ContactTopic | null>(initialTopic);

  const form = useForm<ContactInquiryCreate>({
    resolver: zodResolver(contactInquiryCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      email: '',
      message: '',
      topic: initialTopic ?? ('' as ContactTopic),
      locale,
    },
  });

  // When the visitor steps back to topic picker and then picks another tile,
  // push the new value into the form so submission carries it through the
  // same zod validation the server runs.
  React.useEffect(() => {
    if (selectedTopic) {
      form.setValue('topic', selectedTopic, { shouldValidate: false });
    }
  }, [selectedTopic, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: contactInquiryCreatedSchema,
      });
      toast.success(t('success.title'), {
        description: t('success.body'),
      });
      form.reset({
        name: '',
        email: '',
        message: '',
        topic: '' as ContactTopic,
        locale,
      });
      setSelectedTopic(null);
    } catch (err) {
      const cause = err instanceof Error ? err.cause : undefined;
      const formMsg = (cause as { errors?: { form?: string } } | null | undefined)?.errors?.form;
      const applied = cause ? applyServerErrors(cause, form.setError) : false;
      if (formMsg || !applied) {
        toast.error(formMsg ?? t('error.generic'));
      }
    }
  });

  const onPickTopic = (value: string) => {
    setSelectedTopic(value as ContactTopic);
  };

  const onBackToTopics = () => {
    setSelectedTopic(null);
    form.setValue('topic', '' as ContactTopic, { shouldValidate: false });
  };

  // Keyed on the step so a fresh fade-in animation runs on each transition.
  return (
    <div
      key={selectedTopic ?? 'topics'}
      className="w-full min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {selectedTopic ? (
        <section
          aria-labelledby="contact-step2-heading"
          data-state="visible"
          className="w-full min-w-0"
        >
          <Card className="contact-flow-card surface-panel w-full min-w-0 border-border bg-card shadow-sm">
            <CardContent className="flex w-full min-w-0 flex-col gap-6 p-4 sm:p-8">
              <div className="flex w-full min-w-0 flex-col gap-2">
                <p className="text-eyebrow">{t('eyebrow')}</p>
                <h2
                  id="contact-step2-heading"
                  className="min-w-0 break-words font-display text-h2 leading-tight tracking-tight text-foreground"
                >
                  {tStep('heading')}
                </h2>
                <p className="w-full min-w-0 max-w-xl break-words text-body text-muted-foreground">
                  {tStep('lead')}
                </p>
                <div className="mt-2 flex w-full max-w-full min-w-0 items-start gap-2 whitespace-normal rounded-md border border-brand-500/30 bg-brand-100 px-3 py-1.5 text-small font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300 sm:w-fit">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">
                    {tTopics(`${TOPIC_DEFS.find((d) => d.value === selectedTopic)?.index}.title`)}
                  </span>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={onSubmit} className="flex w-full min-w-0 flex-col gap-4" noValidate>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>{tFields('nameLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            autoComplete="name"
                            placeholder={tFields('namePlaceholder')}
                            className="w-full min-w-0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>{tFields('emailLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder={tFields('emailPlaceholder')}
                            className="w-full min-w-0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>{tFields('messageLabel')}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={6}
                            autoComplete="off"
                            placeholder={tFields('messagePlaceholder')}
                            className="w-full min-w-0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full min-w-0 shadow-sm sm:w-auto sm:self-start"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? t('submitting') : t('submit')}
                  </Button>
                </form>
              </Form>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBackToTopics}
                className="h-auto w-full max-w-full min-w-0 justify-start whitespace-normal text-left text-muted-foreground hover:text-foreground sm:w-auto sm:self-start"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {tStep('backToTopics')}
              </Button>

              <p className="w-full min-w-0 break-words text-small text-muted-foreground">
                {t('footerNote')}
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
        <section
          aria-labelledby="contact-step1-heading"
          data-state="visible"
          className="w-full min-w-0"
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            <p className="text-eyebrow">{t('eyebrow')}</p>
            <h2
              id="contact-step1-heading"
              className="min-w-0 break-words font-display text-h2 leading-tight tracking-tight text-foreground"
            >
              {t('headingLead')}
              <br />
              <span className="text-brand-700 dark:text-brand-300">{t('headingAccent')}</span>
            </h2>
            <p className="w-full min-w-0 max-w-2xl break-words text-body-lg text-muted-foreground">
              {t('lead')}
            </p>
            <p className="w-full min-w-0 max-w-2xl break-words text-small text-muted-foreground">
              {tFields('topicHint')}
            </p>
          </div>

          <RadioGroup
            aria-label={tFields('topicLabel')}
            className="mt-8 grid w-full min-w-0 gap-4 sm:grid-cols-2"
            value={selectedTopic ?? ''}
            onValueChange={onPickTopic}
          >
            {TOPIC_DEFS.map(({ value, index }) => {
              const id = `contact-topic-${value}`;
              return (
                <div
                  key={value}
                  className="group relative w-full min-w-0 cursor-pointer rounded-xl border border-border bg-card shadow-sm transition-colors duration-200 hover:border-brand-500 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-100 dark:has-[[data-state=checked]]:bg-brand-900"
                >
                  <RadioGroupItem
                    id={id}
                    value={value}
                    aria-label={`${tTopics(`${index}.title`)}. ${tTopics(`${index}.description`)}`}
                    className="absolute inset-0 z-10 h-full w-full rounded-xl border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>span]:hidden"
                  />
                  <CardContent
                    aria-hidden="true"
                    className="pointer-events-none flex w-full min-w-0 flex-col gap-2 p-4 sm:p-5"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0 break-words font-display text-base font-semibold leading-tight text-foreground">
                        {tTopics(`${index}.title`)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        data-icon
                        className="size-4 shrink-0 translate-x-[-2px] text-brand-600 transition-transform duration-200 dark:text-brand-400"
                      />
                    </div>
                    <p className="min-w-0 break-words text-small text-muted-foreground">
                      {tTopics(`${index}.description`)}
                    </p>
                  </CardContent>
                </div>
              );
            })}
          </RadioGroup>

          <p className="mt-8 w-full min-w-0 max-w-2xl break-words text-small text-muted-foreground">
            {t('footerNote')}
          </p>
        </section>
      )}
    </div>
  );
}

import { Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SetupStep = {
  id: string;
  label: string;
  completed: boolean;
  ctaLabel?: string;
  ctaHref?: string;
};

export type SetupChecklistProps = {
  title: string;
  description: string;
  steps: SetupStep[];
  /** Optional wrapper id for deep links (e.g. host-checklist). */
  id?: string;
  className?: string;
};

/**
 * Presentational setup list — title, description, and step rows with
 * optional CTAs. Callers own step selection / completion logic.
 */
export function SetupChecklist({
  title,
  description,
  steps,
  id,
  className,
}: SetupChecklistProps) {
  if (steps.length === 0) return null;

  return (
    <Card
      id={id}
      className={cn(
        'border-brand-500/35 bg-brand-50/80 text-card-foreground dark:bg-brand-950/40',
        className,
      )}
    >
      <CardContent className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-small text-muted-foreground">{description}</p>
        </div>
        <ul className="grid gap-3">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    step.completed
                      ? 'border-brand-500 bg-brand-500 text-primary-foreground'
                      : 'border-border bg-card text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span
                  className={cn(
                    'text-small font-medium',
                    step.completed ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!step.completed && step.ctaHref && step.ctaLabel ? (
                <Button asChild size="sm" variant="secondary" className="shrink-0">
                  <Link href={step.ctaHref}>{step.ctaLabel}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

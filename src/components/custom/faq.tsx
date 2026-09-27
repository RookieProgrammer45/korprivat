// each answer can end with an inline <Link> to the relevant booking-flow step.

'use client';

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface QA {
  q: string;
  a: ReactNode;
}

export function Faq({ items }: { items: QA[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item) => (
        <AccordionItem
          key={item.q}
          value={item.q}
          className="border-b border-border last:border-b-0"
        >
          <AccordionTrigger className="py-5 text-left font-display text-base font-medium text-foreground hover:no-underline hover:text-brand-600">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-sm text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

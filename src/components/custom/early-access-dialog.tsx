// @polsia:user-owned — 'use client' island that pairs a custom trigger with
// the shadcn Dialog hosting <WaitlistForm/>. Each CTAs on the landing page
// mounts this island so clicking the button opens the early-access dialog
// properly (and so the Server Component can stay free of browser state).
'use client';

import * as React from 'react';
import { WaitlistForm } from '@/components/custom/waitlist-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { WaitlistRoleValue } from '@/lib/waitlist/schema';

export interface EarlyAccessDialogProps {
  /** Heading inside the dialog. */
  title: string;
  /** Subheading inside the dialog. */
  description: string;
  /** The element that opens the dialog (any clickable child). */
  children: React.ReactNode;
  /** Pre-select the role radio (e.g. INSTRUCTOR from an "Apply to teach" CTA). */
  initialRole?: WaitlistRoleValue;
}

export function EarlyAccessDialog({
  title,
  description,
  children,
  initialRole,
}: EarlyAccessDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border-brand-500/30 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <WaitlistForm initialRole={initialRole} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

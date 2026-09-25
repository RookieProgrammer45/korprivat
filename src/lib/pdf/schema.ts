// @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/pdf@0.1.0. Drift = commit rejected.
//
// Shared schemas for server-side PDF document generation. Safe to import from
// client components: this file has no server-only imports and does not expose
// secrets, env, or the pdf-lib renderer. It is the input contract shared by the
// /api/pdf/document route, the renderer, and the user-owned download button.
//
// Money is represented as integer cents (e.g. 1999 == $19.99), matching the
// customer-app convention. Do not pass floats/dollars.

import { z } from 'zod';

export const documentLineItemSchema = z.object({
  description: z.string().min(1, 'description is required'),
  quantity: z.number().nonnegative(),
  unitAmountCents: z.number().int(),
});

export const documentMetaRowSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
});

export const documentSpecSchema = z.object({
  title: z.string().min(1, 'title is required'),
  subtitle: z.string().optional(),
  meta: z.array(documentMetaRowSchema).optional(),
  lineItems: z.array(documentLineItemSchema).optional(),
  totalCents: z.number().int().optional(),
  notes: z.string().optional(),
  footer: z.string().optional(),
});

export type DocumentLineItem = z.infer<typeof documentLineItemSchema>;
export type DocumentMetaRow = z.infer<typeof documentMetaRowSchema>;
export type DocumentSpec = z.infer<typeof documentSpecSchema>;

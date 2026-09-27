//
// Client and server both import this so a single schema is the source of
// truth for the slot read shape, the editor write shape, and the single-slot
// PATCH shape. Keep this file purely zod (no server-only imports) so the
// instructor-side editor island, the learner-side booking form island, and
// every route handler can depend on it without leaking server-only modules
// into client bundles.
import { z } from 'zod';
import { isValidCalendarDate, isValidLocalTime } from '@/lib/business/provider-timezone';

export const ProviderRoleEnum = z.enum(['INSTRUCTOR', 'HANDLEDARE']);
export type ProviderRole = z.infer<typeof ProviderRoleEnum>;

// Read shape (single row). Mirrors the public-facing fields of
// AvailabilitySlot — `instructor` and `bookedBooking` relations are NOT
// included here so the public GET stays narrow and the editor can render
// `bookedAt` without an `include` across the relation. `startsAt` and
// `endsAt` are ISO UTC strings; the client converts to local for display.
export const AvailabilitySlotItem = z.object({
  id: z.string(),
  instructorId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  durationMinutes: z.number().int().positive(),
  bookedAt: z.string().nullable(),
  providerRole: ProviderRoleEnum,
  timezone: z.string().min(1),
});
export type AvailabilitySlotItem = z.infer<typeof AvailabilitySlotItem>;

export const AvailabilitySlotList = z.object({
  items: z.array(AvailabilitySlotItem),
});
export type AvailabilitySlotList = z.infer<typeof AvailabilitySlotList>;

// Write shape: the instructor-side editor POSTs this to
// POST /api/instructor-availability. `mode` discriminates between bulk
// weekly expansion and a single-add; the union is enforced by the route
// handler, not the schema (zod's discriminatedUnion would require us to
// duplicate shared fields like `durationMinutes`).
//
// Weekly mode sends the operator's intent in plain date / time / weekday
// terms. The server expands `weekdays × weeksAhead` into N concrete UTC
// `startsAt` instants in the instructor's city timezone (Stockholm/Göteborg
// use Europe/Stockholm; other cities fall through to UTC). Single mode
// sends an explicit ISO UTC `startsAt` / `endsAt` pair the client computed.
//
// `durationMinutes` is shared between both modes and acts as the
// `endsAt − startsAt` constraint on the server side.
export const AvailabilitySlotCreate = z
  .object({
    mode: z.enum(['weekly', 'single']),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    startDate: z.string().refine(isValidCalendarDate, 'Use a real date (YYYY-MM-DD)').optional(),
    timeOfDay: z.string().refine(isValidLocalTime, 'Use a valid time (HH:mm)').optional(),
    weeksAhead: z.number().int().min(1).max(12).optional(),
    durationMinutes: z.number().int().min(15).max(240),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'weekly') {
      if (!value.weekdays?.length)
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Choose at least one weekday',
        });
      if (!value.startDate)
        ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a start date' });
      if (!value.timeOfDay)
        ctx.addIssue({ code: 'custom', path: ['timeOfDay'], message: 'Choose a start time' });
      if (value.weeksAhead === undefined)
        ctx.addIssue({ code: 'custom', path: ['weeksAhead'], message: 'Choose how many weeks' });
    }
    if (value.mode === 'single') {
      if (!value.startsAt)
        ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Choose a start time' });
      if (!value.endsAt)
        ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Choose an end time' });
      if (value.startsAt && value.endsAt) {
        const duration = new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime();
        if (!Number.isFinite(duration) || duration !== value.durationMinutes * 60_000) {
          ctx.addIssue({
            code: 'custom',
            path: ['durationMinutes'],
            message: 'End time must match the duration',
          });
        }
      }
    }
  });
export type AvailabilitySlotCreate = z.infer<typeof AvailabilitySlotCreate>;

// Single-row PATCH shape: the editor sends `startsAt` / `endsAt` (or one
// of the two) to nudge an open slot. The route handler enforces the
// invariant `endsAt > startsAt > now` and rejects edits on booked slots.
export const AvailabilitySlotUpdate = z
  .object({
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
  })
  .refine((v) => v.startsAt !== undefined || v.endsAt !== undefined, {
    message: 'Provide at least one of startsAt or endsAt',
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && value.durationMinutes !== undefined) {
      const duration = new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime();
      if (duration !== value.durationMinutes * 60_000) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: 'End time must match the duration',
        });
      }
    }
  });
export type AvailabilitySlotUpdate = z.infer<typeof AvailabilitySlotUpdate>;

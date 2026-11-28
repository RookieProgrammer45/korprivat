import { z } from 'zod';

export const SALE_CURRENCIES = [
  'SEK',
  'NOK',
  'DKK',
  'EUR',
  'GBP',
  'USD',
  'AUD',
  'BRL',
  'CLP',
  'COP',
  'MXN',
  'PLN',
] as const;

const VIN = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const PLATE = /\b[A-Z]{3}\s?\d{2,3}[A-Z]?\b/i;

/** Registration numbers and VINs are not stored on a listing or a message. */
export function containsVehicleIdentifier(value: string): boolean {
  return VIN.test(value) || PLATE.test(value);
}

const text = z.string().trim();

export const ownedVehicleSchema = z
  .object({
    make: text.min(1).max(40),
    model: text.min(1).max(40),
    year: z.number().int().min(1980).max(2027).nullable(),
    country: z.string().regex(/^[A-Z]{2}$/),
    currency: z.enum(SALE_CURRENCIES),
    city: text.min(1).max(80),
    askingAmount: z.number().int().positive().max(50_000_000).nullable(),
    note: text.max(500).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.note && containsVehicleIdentifier(value.note)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'identifier' });
    }
  });

export const vehicleThreadSchema = z
  .object({
    listingId: z.string().min(1).max(64),
    conversationId: z.string().min(1).max(64).nullable(),
    body: text.min(1).max(2000),
  })
  .superRefine((value, ctx) => {
    if (containsVehicleIdentifier(value.body)) {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'identifier' });
    }
  });

export type OwnedVehicleInput = z.infer<typeof ownedVehicleSchema>;

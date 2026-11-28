import { describe, expect, it } from 'vitest';
import { containsVehicleIdentifier, ownedVehicleSchema } from '@/lib/vehicle-sales/schema';

describe('owned vehicle input', () => {
  it('rejects a registration number or a VIN in the note', () => {
    expect(containsVehicleIdentifier('ABC 123')).toBe(true);
    expect(containsVehicleIdentifier('1HGBH41JXMN109186')).toBe(true);
    const parsed = ownedVehicleSchema.safeParse({
      make: 'Volvo',
      model: 'XC60',
      year: 2020,
      country: 'SE',
      currency: 'SEK',
      city: 'Stockholm',
      askingAmount: null,
      note: 'Reg ABC123',
    });
    expect(parsed.success).toBe(false);
  });
});

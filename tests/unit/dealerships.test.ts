import { describe, expect, it } from 'vitest';
import {
  cheapestVehicle,
  compareDealerships,
  type Dealership,
  type DealershipVehicle,
  listDealerships,
  publishedCars,
  searchPublishedCars,
} from '@/lib/discovery/dealerships';
import { dealerSearchPath } from '@/lib/seo/dealer-search-path';

function vehicle(
  partial: Partial<DealershipVehicle> & Pick<DealershipVehicle, 'price' | 'currency'>,
): DealershipVehicle {
  return {
    name: 'Bil',
    kind: 'car',
    sourceUrl: 'https://example.se/bil',
    year: null,
    mileage: null,
    mileageUnit: null,
    fuel: null,
    gearbox: null,
    imageUrl: null,
    make: null,
    model: null,
    condition: null,
    priceKind: null,
    power: null,
    color: null,
    ...partial,
  };
}

function dealer(partial: Partial<Dealership> & Pick<Dealership, 'id' | 'name'>): Dealership {
  return {
    country: 'SE',
    city: 'Malmö',
    address: '',
    website: null,
    phone: null,
    email: null,
    logoUrl: null,
    brands: [],
    categories: ['Bilhandel'],
    sourceUrl: 'https://www.mrf.se/medlem/sok-medlem/',
    sourceName: 'MRF',
    checkedAt: '2026-11-25',
    vehicles: [],
    ...partial,
  };
}

describe('compareDealerships', () => {
  it('orders by the cheapest published vehicle and leaves unpriced dealers last', () => {
    const pricey = dealer({
      id: 'a',
      name: 'Alfa',
      vehicles: [vehicle({ price: 220000, currency: 'SEK', sourceUrl: 'https://a.se' })],
    });
    const cheap = dealer({
      id: 'b',
      name: 'Beta',
      vehicles: [vehicle({ price: 99000, currency: 'SEK', sourceUrl: 'https://b.se' })],
    });
    const quiet = dealer({ id: 'c', name: 'Ceder' });
    expect([pricey, quiet, cheap].sort(compareDealerships).map((row) => row.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(cheapestVehicle(pricey)?.price).toBe(220000);
  });

  it('does not rank a cheaper foreign currency ahead of kronor', () => {
    const sek = dealer({
      id: 'sek',
      name: 'Svensson',
      vehicles: [vehicle({ price: 180000, currency: 'SEK', sourceUrl: 'https://a.se' })],
    });
    const nok = dealer({
      id: 'nok',
      name: 'Nilsen',
      country: 'NO',
      vehicles: [vehicle({ price: 90000, currency: 'NOK', sourceUrl: 'https://b.no' })],
    });
    expect([nok, sek].sort(compareDealerships).map((row) => row.id)).toEqual(['sek', 'nok']);
  });

  it('lists a car only when the dealer published a spec, cheapest kronor first', () => {
    const plain = dealer({
      id: 'plain',
      name: 'Utan spec',
      vehicles: [vehicle({ price: 50000, currency: 'SEK', sourceUrl: 'https://plain.se' })],
    });
    const specified = dealer({
      id: 'spec',
      name: 'Med spec',
      city: 'Borlänge',
      vehicles: [
        vehicle({
          name: 'Volvo V40',
          price: 139500,
          currency: 'SEK',
          sourceUrl: 'https://spec.se/v40',
          year: 2015,
          mileage: 5000,
          mileageUnit: 'mil',
          fuel: 'Bensin',
          gearbox: 'Manuell',
        }),
      ],
    });
    const foreign = dealer({
      id: 'no',
      name: 'Norsk',
      country: 'NO',
      vehicles: [
        vehicle({
          name: 'Volvo EX40',
          price: 10000,
          currency: 'NOK',
          sourceUrl: 'https://no.example/ex40',
          year: 2024,
          fuel: 'El',
        }),
      ],
    });
    const cars = publishedCars([foreign, plain, specified]);
    expect(cars.map((car) => car.vehicle.name)).toEqual(['Volvo V40', 'Volvo EX40']);
    expect(cars[0]?.dealerCity).toBe('Borlänge');
  });

  it('includes Danish dealers from the public member list', () => {
    const danish = listDealerships().filter((dealer) => dealer.country === 'DK' && dealer.website);
    expect(danish.length).toBeGreaterThan(100);
    expect(danish.every((dealer) => dealer.sourceName === 'DI Bilbranchen')).toBe(true);
  });

  it('reads model, year and fuel from the published dealer file', () => {
    const cars = publishedCars();
    expect(cars.length).toBeGreaterThan(20);
    expect(cars[0]?.vehicle.year).toEqual(expect.any(Number));
    expect(
      cars.some((car) => car.vehicle.fuel && car.vehicle.gearbox && car.vehicle.imageUrl),
    ).toBe(true);
  });

  it('builds a comparison URL from the city and vehicle kind', () => {
    expect(dealerSearchPath('')).toBe('/bilhandlare');
    expect(dealerSearchPath('Oslo', 'car')).toBe('/bilhandlare?city=Oslo&kind=car');
    expect(dealerSearchPath('Malmö', 'nope')).toBe('/bilhandlare?city=Malm%C3%B6');
    expect(dealerSearchPath('New York', null, 'Volvo')).toBe('/bilhandlare?q=Volvo&city=New+York');
  });

  it('keeps a Volvo in Rochester out of a New York search', () => {
    const rochester = searchPublishedCars({ q: 'Volvo XC90', city: 'Rochester', condition: 'new' });
    expect(rochester.length).toBeGreaterThan(0);
    expect(
      rochester.every((car) => car.dealerCity === 'Rochester' && car.vehicle.priceKind === 'msrp'),
    ).toBe(true);
    expect(
      searchPublishedCars({ q: 'Volvo', city: 'New York' }).some(
        (car) => car.dealerCountry === 'US',
      ),
    ).toBe(false);
  });

  it('does not rank a dollar price ahead of kronor', () => {
    const cars = publishedCars();
    const lastKrona = cars.findLastIndex((car) => car.vehicle.currency === 'SEK');
    const firstDollar = cars.findIndex((car) => car.vehicle.currency === 'USD');
    expect(lastKrona).toBeGreaterThanOrEqual(0);
    expect(firstDollar).toBeGreaterThan(lastKrona);
  });

  it('matches a used motorcycle to the place and model', () => {
    const shop = dealer({
      id: 'ny-moto',
      name: 'Hudson Motorcycles',
      city: 'New York',
      country: 'US',
      vehicles: [
        vehicle({
          name: 'Harley Sportster',
          make: 'Harley',
          model: 'Sportster',
          kind: 'motorcycle',
          condition: 'used',
          price: 9000,
          currency: 'USD',
          sourceUrl: 'https://example.com/sportster',
          year: 2019,
          mileage: 12000,
          mileageUnit: 'km',
          fuel: 'Petrol',
        }),
      ],
    });
    const found = searchPublishedCars(
      { q: 'Harley', city: 'New York', kind: 'motorcycle', condition: 'used' },
      [shop],
    );
    expect(found.map((car) => car.dealerName)).toEqual(['Hudson Motorcycles']);
    expect(
      searchPublishedCars({ q: 'Harley', city: 'New York', condition: 'new' }, [shop]),
    ).toEqual([]);
  });
});

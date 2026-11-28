import 'server-only';
import { listDealerships } from '@/lib/discovery/dealerships';
import type { MarketComparable } from '@/lib/discovery/vehicle-market-price';

export function catalogueComparables(): MarketComparable[] {
  return listDealerships().flatMap((dealer) =>
    dealer.vehicles.map((vehicle) => ({
      country: dealer.country,
      dealerId: dealer.id,
      dealerName: dealer.name,
      dealerCity: dealer.city,
      sourceUrl: vehicle.sourceUrl,
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      price: vehicle.price,
      currency: vehicle.currency,
      priceKind: vehicle.priceKind,
    })),
  );
}

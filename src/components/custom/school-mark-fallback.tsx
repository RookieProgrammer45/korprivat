import { Car, Truck } from 'lucide-react';
import {
  type SchoolHeavyAdvertised,
  schoolInitials,
  schoolMarkSymbol,
} from '@/lib/discovery/school-portrait';

/** How much of the mark box the vehicle icon fills (same role as a contained logo). */
export type SchoolMarkIconLayout = 'cover' | 'avatar' | 'hero' | 'thumb' | 'deck';

function markIconClass(layout: SchoolMarkIconLayout): string {
  return `dlu-school-mark-icon dlu-school-mark-icon--${layout}`;
}

export function SchoolMarkFallback({
  name,
  categories,
  heavy,
  heavyScope = false,
  iconLayout = 'cover',
  className,
}: {
  name: string;
  categories: readonly string[];
  heavy?: SchoolHeavyAdvertised | null;
  heavyScope?: boolean;
  iconLayout?: SchoolMarkIconLayout;
  className: string;
}) {
  const symbol = schoolMarkSymbol(categories, heavy, { heavyScope });
  const iconClass = markIconClass(iconLayout);

  const vehicleStroke = iconLayout === 'cover' || iconLayout === 'hero' ? 1.25 : 1.5;

  return (
    <span aria-hidden className={className}>
      {symbol === 'light' ? (
        <Car className={iconClass} strokeWidth={vehicleStroke} />
      ) : symbol === 'heavy' ? (
        <Truck className={iconClass} strokeWidth={vehicleStroke} />
      ) : (
        schoolInitials(name)
      )}
    </span>
  );
}

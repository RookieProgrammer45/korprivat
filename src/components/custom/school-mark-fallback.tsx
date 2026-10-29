import { Car, Truck } from 'lucide-react';
import {
  type SchoolHeavyAdvertised,
  schoolInitials,
  schoolMarkSymbol,
} from '@/lib/discovery/school-portrait';

export function SchoolMarkFallback({
  name,
  categories,
  heavy,
  heavyScope = false,
  className,
  iconClassName = 'size-7',
}: {
  name: string;
  categories: readonly string[];
  heavy?: SchoolHeavyAdvertised | null;
  heavyScope?: boolean;
  className: string;
  iconClassName?: string;
}) {
  const symbol = schoolMarkSymbol(categories, heavy, { heavyScope });

  return (
    <span aria-hidden className={className}>
      {symbol === 'light' ? (
        <Car className={iconClassName} strokeWidth={1.75} />
      ) : symbol === 'heavy' ? (
        <Truck className={iconClassName} strokeWidth={1.75} />
      ) : (
        schoolInitials(name)
      )}
    </span>
  );
}

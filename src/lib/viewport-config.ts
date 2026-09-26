// @polsia:user-owned — spread into the framework layout's `viewport` export.
// `themeColor` (browser chrome) defaults to the brand seed; add colorScheme etc. here.

import type { Viewport } from 'next';
import { brandVisual } from '@/lib/brand';

export const viewportConfig: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: brandVisual.themeColor,
};

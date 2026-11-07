import 'server-only';
import type { Locale } from '@/i18n/config';
import da from '../../../messages/da.json';
import de from '../../../messages/de.json';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import fi from '../../../messages/fi.json';
import fr from '../../../messages/fr.json';
import it from '../../../messages/it.json';
import nb from '../../../messages/nb.json';
import nl from '../../../messages/nl.json';
import pl from '../../../messages/pl.json';
import sv from '../../../messages/sv.json';

export const messageCatalogs = {
  sv,
  en,
  nb,
  da,
  fi,
  de,
  fr,
  nl,
  es,
  it,
  pl,
} as const satisfies Record<Locale, typeof sv>;

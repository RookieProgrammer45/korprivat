import { permanentRedirect } from 'next/navigation';
import { LEGACY_INSTRUCTOR_CITY_REDIRECTS } from '@/lib/seo/nordic-locations';

export default function MalmoInstructorsRedirect() {
  permanentRedirect(LEGACY_INSTRUCTOR_CITY_REDIRECTS.malmo);
}

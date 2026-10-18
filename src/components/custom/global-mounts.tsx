// Writable home for root/global UI (Cmd+K palette, global keyboard listeners,
// app-wide overlays/dialogs), mounted once at the app root by layout.tsx.
// Put root mounts here, NOT in framework-owned layout.tsx.

'use client';

import { AdSenseLoader } from '@/components/custom/adsense-loader';
import { ChatbotMount } from '@/components/custom/chatbot-mount';
import { ConsentBanner } from '@/components/custom/consent-banner';

export function GlobalMounts() {
  return (
    <>
      <ChatbotMount />
      <ConsentBanner />
      <AdSenseLoader />
    </>
  );
}

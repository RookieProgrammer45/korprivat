import type { Metadata } from 'next';
import { HandledareApproveClient } from './approve-client';

export const metadata: Metadata = {
  title: 'Godkänn handledarskap — DriveLinkUp',
  robots: { index: false, follow: false },
};

export default async function HandledareApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="mx-auto grid max-w-lg gap-4 px-4 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Godkänn handledarskap
      </h1>
      <p className="text-muted-foreground">
        Bekräfta att du tar handledaransvar för övningskörning enligt Trafikverket. Detta är
        inte föräldramedgivande — det är handledarskap.
      </p>
      <HandledareApproveClient token={token} />
    </div>
  );
}

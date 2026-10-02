// Pure host-activation step picker (licence → listing → Connect → availability).

export type HostChecklistSteps = {
  licenceVerified: boolean;
  hasListing: boolean;
  connectReady: boolean;
  hasAvailability: boolean;
};

export type HostChecklistAction = 'licence' | 'listing' | 'connect' | 'availability';

export function pickHostChecklistAction(
  steps: HostChecklistSteps,
): HostChecklistAction | null {
  if (!steps.licenceVerified) return 'licence';
  if (!steps.hasListing) return 'listing';
  if (!steps.connectReady) return 'connect';
  if (!steps.hasAvailability) return 'availability';
  return null;
}

export function isHostSetupComplete(steps: Omit<HostChecklistSteps, 'licenceVerified'>): boolean {
  return steps.hasListing && steps.connectReady && steps.hasAvailability;
}

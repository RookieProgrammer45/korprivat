'use client';

import { useCallback, useState } from 'react';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export type Coords = { latitude: number; longitude: number };

type State = {
  status: LocationStatus;
  coords: Coords | null;
  error: string | null;
};

// Browser-side hook that wraps `navigator.geolocation.getCurrentPosition`.
// NEVER requests the permission on mount — the only way `request()` runs is
// from an explicit user click on the directory "Use my location" button. The
// `reset()` action snaps the hook back to `idle` so a learner who manually
// clears the lat/lng URL params doesn't see a stale "granted" badge.
export function useUserLocation() {
  const [state, setState] = useState<State>({ status: 'idle', coords: null, error: null });

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unsupported', coords: null, error: null });
      return;
    }
    setState((curr) => ({ status: 'requesting', coords: curr.coords, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'granted',
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          error: null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: 'denied', coords: null, error: null });
          return;
        }
        // TIMEOUT / POSITION_UNAVAILABLE — surface as "denied" so the
        // learner can retry; the directory still works via the city filter.
        setState({ status: 'denied', coords: null, error: err.message });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', coords: null, error: null });
  }, []);

  return { ...state, request, reset };
}

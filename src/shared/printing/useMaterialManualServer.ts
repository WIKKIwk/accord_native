import { useEffect, useRef } from 'react';
import type { DiscoveredServer } from '../../gscale/gscaleDiscovery';

/** @v2 _ManualServerSheetState._submit: a dismissed form cannot finish a later probe. */
export function useMaterialManualServer(probe: () => Promise<DiscoveredServer | null>, isCurrent: () => boolean,
  complete: (server: DiscoveredServer) => void) {
  const mounted = useRef(true), busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return async () => {
    if (busy.current || !mounted.current || !isCurrent()) return;
    busy.current = true;
    try { const server = await probe(); if (server && mounted.current && isCurrent()) complete(server); }
    finally { busy.current = false; }
  };
}

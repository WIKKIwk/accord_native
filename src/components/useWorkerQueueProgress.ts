import { useEffect, useState } from 'react';

/** V2's queue progress has a 300ms grace period; the detail card uses its own 2s grace. */
export function useWorkerQueueProgress(active: boolean) {
  const [state, setState] = useState({ active, visible: false });
  if (state.active !== active) setState({ active, visible: false });
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setState({ active: true, visible: true }), 300);
    return () => clearTimeout(timer);
  }, [active]);
  return active && state.active && state.visible;
}

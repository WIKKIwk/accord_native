import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

/** Admit descendants after the original page starts; blur affects interaction, while cleanup retires every captured callback. */
export function useAdminPageAuthority(isCurrent: () => boolean, canInteract: () => boolean) {
  const lifetime = useRef({ active: false, generation: 0 }), [generation, setGeneration] = useState(0);
  useLayoutEffect(() => { const ticket = lifetime.current; ticket.active = true; ticket.generation++; setGeneration(ticket.generation);
    return () => { ticket.active = false; ticket.generation++; };
  }, [isCurrent]);
  const current = useCallback(() => generation > 0 && lifetime.current.active && lifetime.current.generation === generation && isSynchronouslyTrue(isCurrent) &&
    lifetime.current.active && lifetime.current.generation === generation, [isCurrent, generation]);
  const interactive = useCallback(() => current() && isSynchronouslyTrue(canInteract) && current(), [current, canInteract]);
  return { current, interactive, generation };
}

import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';

class PassiveBinding {
  private readonly lifetime: QolipLocationChoiceLifetime;
  private expired = false;
  constructor(private readonly original: QolipHomeReadBoundary) { this.lifetime = new QolipLocationChoiceLifetime(original); }
  subscribe = (listener: () => void) => this.lifetime.subscribe(listener);
  current(boundary: QolipHomeReadBoundary) {
    if (boundary !== this.original) this.expired = true;
    return !this.expired && this.lifetime.getSnapshot();
  }
  activate() { if (!this.expired) this.lifetime.activate(); return () => this.lifetime.suspend(); }
}

/** One original-witness presentation lifetime; changing the boundary closes it permanently. */
export function useQolipPassiveBoundary(boundary: QolipHomeReadBoundary) {
  const binding = useMemo(() => new PassiveBinding(boundary), []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = () => binding.current(boundary);
  const valid = useSyncExternalStore(binding.subscribe, current, current);
  useLayoutEffect(() => binding.activate(), [binding]);
  return { valid, isCurrent: current };
}

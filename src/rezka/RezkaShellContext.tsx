import { createContext, useContext } from 'react';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

export type RezkaDestination = 'queue' | 'workers' | 'daily' | 'instructions' | 'profile';
type RezkaShellContextValue = { snapshot: RezkaSessionSnapshot; openDrawer: () => void; onLogout: () => void;
  navigate: (destination: RezkaDestination) => void };
export const RezkaShellContext = createContext<RezkaShellContextValue | null>(null);
export function useRezkaShellContext(): RezkaShellContextValue {
  const value = useContext(RezkaShellContext);
  if (!value) throw new Error('Rezka session is not available.');
  return value;
}

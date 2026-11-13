import { createContext, useContext } from 'react';
import type { Session } from '../auth';

export type MetalayzerContextValue = { session: Session; onLogout(): void; isCurrent(): boolean };
export const MetalayzerContext = createContext<MetalayzerContextValue | null>(null);

export function useMetalayzerContext(): MetalayzerContextValue {
  const value = useContext(MetalayzerContext);
  if (!value) throw new Error('Metalayzer sessiyasi mavjud emas');
  return value;
}

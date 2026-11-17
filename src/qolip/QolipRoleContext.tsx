import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
export type QolipRoleReadBoundary = QolipHomeReadBoundary;
export type QolipRoleContextValue = {
  session: Session; boundary: QolipHomeReadBoundary; isCurrent(): boolean;
  notice(message: string): void; onMenu(): void; onProfile(): void; onLogout(): void; dock: ReactNode;
};
export const QolipRoleContext = createContext<QolipRoleContextValue | null>(null);
export function useQolipRole(): QolipRoleContextValue {
  const value = useContext(QolipRoleContext);
  if (!value) throw new Error('Qolip sessiyasi mavjud emas');
  return value;
}

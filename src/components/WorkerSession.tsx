import { createContext, useContext } from 'react';
import type { Session } from '../auth';

type WorkerSession = { session: Session; onLogout: () => void; onOpenDrawer?: () => void; setChatClosing: (closing: boolean) => void };

export const WorkerSessionContext = createContext<WorkerSession | null>(null);

export function useWorkerSession(): WorkerSession {
  const value = useContext(WorkerSessionContext);
  if (!value) throw new Error('Worker session is not available.');
  return value;
}

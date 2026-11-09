import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import { BoyoqchiProvider } from './BoyoqchiContext';
import { BoyoqchiDrawer } from './BoyoqchiDrawer';
export function BoyoqchiContextShell({ session, witness, onLogout, children }: { session: Session; witness: SessionWitness; onLogout: () => void; children: ReactNode }) {
  return <BoyoqchiProvider session={session} witness={witness} onLogout={onLogout}><BoyoqchiDrawer>{children}</BoyoqchiDrawer></BoyoqchiProvider>;
}

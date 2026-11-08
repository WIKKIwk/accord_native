import type { ReactNode } from 'react';
import type { Session } from '../auth';
import { BoyoqchiProvider } from './BoyoqchiContext';
import { BoyoqchiDrawer } from './BoyoqchiDrawer';
export function BoyoqchiContextShell({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  return <BoyoqchiProvider session={session} onLogout={onLogout}><BoyoqchiDrawer>{children}</BoyoqchiDrawer></BoyoqchiProvider>;
}

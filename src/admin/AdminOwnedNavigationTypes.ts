import type { ReactElement } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUserListEntry } from './adminUsersModel';

export type AdminOwnedActionAuthority = Readonly<{ isCurrent: () => boolean; canInteract: () => boolean }>;
/** Missing source FAB destinations keep Users admission held; a fake/null renderer cannot mark it ready. */
export type AdminOwnedRouteProviders = Readonly<{
  primaryAvailable: () => boolean;
  renderPrimaryAction: (authority: AdminOwnedActionAuthority) => ReactElement;
  /** Supplied only when an actual guarded chat thread/store destination is available on this platform. */
  renderChatAction?: (authority: AdminOwnedActionAuthority & { session: Session; witness: SessionWitness; entry: AdminUserListEntry; onNotice: (message: string) => void }) => ReactElement | null;
}>;

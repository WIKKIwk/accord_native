import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUserListEntry } from './adminUsersModel';

export type AdminWorkerDetailAvatarProps = { avatarUrl: string; fallbackText: string; displayName: string; size: number; isCurrent: () => boolean };
/** Real shell/preview/chat/activity destinations are supplied before this held screen can be routed. */
export type AdminWorkerDetailScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; entry: AdminUserListEntry; readOnly?: boolean;
  backLabel: string; onBack: (changed: boolean) => void; footer: ReactNode; profileAction: ReactElement;
  renderAvatar: (props: AdminWorkerDetailAvatarProps) => ReactElement;
  renderChatAction?: (isCurrent: () => boolean) => ReactElement;
  onOpenActivity: (entry: AdminUserListEntry) => void | Promise<unknown>;
};

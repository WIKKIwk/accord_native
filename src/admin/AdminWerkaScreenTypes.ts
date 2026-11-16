import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

/** displayName is the source preview title (initials here), separate from the visible full-name header. */
export type AdminWerkaAvatarProps = { avatarUrl: string; fallbackText: string; displayName: string; size: number; isCurrent: () => boolean; canInteract: () => boolean };
export type AdminWerkaScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  backLabel: string; onBack: (changed: boolean) => void; footer?: ReactNode;
  profileAction: ReactElement;
  /** Real guarded avatar/preview and optional chat action come from the owning shell. */
  renderAvatar: (props: AdminWerkaAvatarProps) => ReactElement;
  chatAction?: ReactElement;
};

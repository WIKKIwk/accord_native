import type { Session, SessionWitness } from '../auth';

export type AdminProfileAvatarProps = {
  session: Session; witness: SessionWitness;
  /** Original account and mounted-parent authority. It must survive preview presentation/parent blur. */
  isCurrent: () => boolean;
  /** Focus and native-interaction authority for opening a preview. */
  canInteract: () => boolean;
  avatarUrl: string; fallbackText: string; size?: number; displayName?: string;
};

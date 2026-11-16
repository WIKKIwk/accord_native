import type { Session, SessionWitness } from '../auth';

export type AdminProfileActionProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; canInteract: () => boolean;
  /** The actual profile destination supplied by the owning navigation boundary. */
  onProfile: () => void;
};

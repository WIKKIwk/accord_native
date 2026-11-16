import type { AdminItemDetailActionMenuClose, AdminItemDetailActionMenuController } from './adminItemDetailActionMenuController';
import type { AdminItemDetailActionMenuTicket } from './adminItemDetailActionMenuModel';

/** Content for a genuine Source bottom-sheet owner. The host supplies actual top authority and hides this exact window. */
export type AdminItemDetailActionMenuContentProps = Readonly<{
  surfaceIdentity: object;
  controller: AdminItemDetailActionMenuController; ticket: AdminItemDetailActionMenuTicket; generation: number;
  /** Original account and this exact native surface, independent of body mount, focus and accepted closing. */
  isCurrent: () => boolean;
  canInteract: () => boolean; onCloseRequested: (close: AdminItemDetailActionMenuClose) => void;
  a: (key: string) => string;
}>;

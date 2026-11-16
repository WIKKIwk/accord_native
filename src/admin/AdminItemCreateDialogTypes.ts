import type { ReactElement, ReactNode } from 'react';

export type AdminItemCreateDialogPresentation = Readonly<{
  /** Identity belongs to one original native window, across closing renders. */
  identity: object; kind: 'create' | 'move'; visible: boolean; isCurrent: () => boolean; isClosing: () => boolean; canInteract: () => boolean;
  scrimOpacity: .32 | .54; horizontalInset: number; maxWidth: number;
  onDismissRequest: () => void; onDismissed: () => void; children: ReactNode;
}>;
/** Android requires an actual native-window completion owner. There is no timer or JS unmount fallback.
 * Arm the original dialog root BEFORE removing it; call onDismissed only for that original native root's detach acknowledgement.
 */
export type AdminItemCreateDialogPortal = Readonly<{
  isAvailable: () => boolean;
  render: (props: AdminItemCreateDialogPresentation) => ReactElement;
}>;

import type { AdminItemDetailCloseTicket, AdminItemDetailDecisionController, AdminItemDetailDecisionDialog } from './adminItemDetailDecisionController';

export type AdminItemDetailDecisionKind = AdminItemDetailDecisionDialog['kind'];
/** Actual own route MediaQuery-equivalent facts, not covered page/dock insets. null holds content only; the real host still owns Source barrier/back cancellation. */
export type AdminItemDetailDecisionViewport = Readonly<{ width: number; height: number; paddingBottom: number }>;
/** Original native surface identity/authority. Neither React mount nor these callbacks certify native readiness. */
export type AdminItemDetailDecisionHost = Readonly<{
  surfaceIdentity: object; controller: AdminItemDetailDecisionController; dialogId: number; kind: AdminItemDetailDecisionKind; generation: number;
  /** Original account + parent + this exact surface lifetime, independent of focus and accepted closing. */
  isCurrent: () => boolean;
  /** Actual OWN native surface top/ready/not-closing authority; never the covered page predicate. */
  canInteract: () => boolean;
  /** Hide this exact real window. Only its original native ACK may call controller.completeClose(ticket). */
  onCloseRequested: (ticket: AdminItemDetailCloseTicket) => void;
}>;
type Text = Readonly<{ a: (key: string, values?: Record<string, unknown>) => string; t: (key: string) => string }>;
export type AdminItemDetailDecisionContentProps = AdminItemDetailDecisionHost & Text & (
  | Readonly<{ kind: 'edit' | 'delete' }>
  | Readonly<{ kind: 'group'; viewport: AdminItemDetailDecisionViewport | null }>
);

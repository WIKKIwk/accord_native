import type { ReactElement } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminItemDetailDecisionController } from './adminItemDetailDecisionController';
import type { AdminItemDetail } from './adminItemDetailModel';

export type AdminItemDetailReadContext = Readonly<{
  session: Session; witness: SessionWitness; controller: AdminItemDetailDecisionController; generation: number;
  /** Original page/account authority survives ordinary parent blur. */
  isCurrent: () => boolean;
  /** Genuine focused/top/not-closing authority supplied by the real ancestor. */
  canInteract: () => boolean;
}>;
export type AdminItemDetailPresentations = Readonly<{
  /** Must render real decision/action surfaces and acknowledge their actual native completion. */
  render: (context: AdminItemDetailReadContext) => ReactElement;
  onActions: (context: AdminItemDetailReadContext, detail: AdminItemDetail, kind: 'finished' | 'combo') => void;
}>;
export type AdminItemDetailReadProps = Readonly<{
  /** Never reuse a real page identity for another session, witness or original lifetime predicate. */
  session: Session; witness: SessionWitness; pageIdentity: object; itemCode: string;
  isCurrent: () => boolean; canInteract: () => boolean;
  onBack: (changed: boolean) => void; backLabel: string;
  /** Real Source Settings-active Admin dock, with its primary FAB absent. */
  footer: ReactElement; presentations: AdminItemDetailPresentations;
}>;
export type AdminItemDetailNativeHeader = Readonly<{
  title: string; backAction: ReactElement; isCurrent: () => boolean; canInteract: () => boolean;
}>;
/** The real ancestor must mount this in its VISIBLE UIKit/SwiftUI navigation bar, not a hidden file Stack.Screen. */
export type AdminItemDetailNativeHeaderRenderer = (header: AdminItemDetailNativeHeader) => ReactElement;

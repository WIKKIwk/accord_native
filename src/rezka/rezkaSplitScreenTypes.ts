import type { RezkaSessionSnapshot } from './rezkaSessionGuard';
import type { RezkaScannerAction } from './rezkaScannerOwner';
import type { RezkaOutput } from './rezkaSplitApi';
import type { RezkaPrinterTarget, RezkaSplitState, RezkaTransport } from './rezkaSplitController';

/** Adapter to the reviewed shared printer picker and real local print service. No mock implementation is provided. */
export type RezkaPrinterBridge = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): { title: string; subtitle: string; excluded?: boolean };
  choose(): Promise<{ transport: RezkaTransport; driverUrl?: string } | null>;
  resolve(state: RezkaSplitState): Promise<RezkaPrinterTarget | null>;
  print(output: RezkaOutput, target: RezkaPrinterTarget): Promise<{ ok: boolean }>;
};
export type RezkaSplitScreenProps = { snapshot: RezkaSessionSnapshot; printer: RezkaPrinterBridge | null;
  /** The full-screen scanner and its synchronous focused-owner guard. */
  scan?: RezkaScannerAction;
  onBack?: () => void;
};

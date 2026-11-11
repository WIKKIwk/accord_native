import { useLayoutEffect, useState } from 'react';
import { WorkerOrderMergeFlow, type WorkerMergeProof, type WorkerMergeState, type WorkerMergeTarget } from '../workerOrderMerge';
import type { WorkerFabReads } from '../workerFabQr';

type Options = {
  identity: string; available: boolean; current(): boolean; target: WorkerMergeTarget;
  reads(): WorkerFabReads; p(key: string, values?: Record<string, unknown>): string;
  write(qr: string, proof: WorkerMergeProof, current: () => boolean): Promise<boolean>;
  notice(message: string): void;
};

/** @v2 _ReadOnlyOrderDetailSheetState._handleQuickScan */
export function useWorkerOrderMerge(options: Options) {
  const [state, setState] = useState<WorkerMergeState>({ phase: 'closed' });
  const dependencies = { available: () => options.available && options.current(), current: options.current,
    target: () => options.target, reads: options.reads, p: options.p, write: options.write, changed: setState, notice: options.notice };
  const [flow] = useState(() => new WorkerOrderMergeFlow(dependencies));
  useLayoutEffect(() => { flow.configure(dependencies); if (!options.current()) flow.cancel(); });
  useLayoutEffect(() => () => flow.cancel(), [flow, options.identity]);
  return { state, flow, scanning: state.phase === 'scanning' || state.phase === 'checking',
    pending: !['closed', 'scanning'].includes(state.phase) };
}

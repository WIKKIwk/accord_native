export type WorkerOrderPresentation<T> = { scope: string; signature: string; data: T };
export type WorkerOrderPresentationInput = { scope: string; eligible: boolean; synchronized: boolean };

/** @v2 _WorkerOrderPresentation._workerPresentationFor */
export function workerOrderPresentationFor<T>(previous: WorkerOrderPresentation<T> | null, input: WorkerOrderPresentationInput, current: T) {
  const saved = input.eligible && previous?.scope === input.scope ? previous : null;
  if (!input.eligible || !input.synchronized) return { next: saved, data: saved?.data ?? current, retaining: !!saved };
  // Only JSON display data enters this cache. No control contract, scan proof or write permission is returned.
  const signature = JSON.stringify(current);
  const next = saved?.signature === signature ? saved : { scope: input.scope, signature, data: JSON.parse(signature) as T };
  return { next, data: current, retaining: false };
}

/** @v2 _ReadOnlyOrderDetailSheetState._markDetailRecoveryNeeded */
export function workerOrderPresentationDenied(error: unknown): boolean {
  const value = error as { statusCode?: number; code?: string };
  return value?.statusCode === 401 || value?.statusCode === 403 ||
    ['unauthorized', 'forbidden', 'order_not_available', 'worker_order_not_available', 'training_order_scan_bootstrap_unsupported'].includes(value?.code ?? '');
}

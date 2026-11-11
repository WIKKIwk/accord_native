import { useState } from 'react';
import { workerOrderPresentationFor, type WorkerOrderPresentation, type WorkerOrderPresentationInput } from '../workerOrderPresentation';

/** @v2 _WorkerDetailPresentation */
export function useWorkerOrderPresentation<T>(input: WorkerOrderPresentationInput, current: T) {
  const [previous, setPrevious] = useState<WorkerOrderPresentation<T> | null>(null);
  const result = workerOrderPresentationFor(previous, input, current);
  // Adjust this component's display history before committing children. The signature makes this update bounded.
  if (result.next !== previous) setPrevious(result.next);
  return { ...result, clear: () => setPrevious(null) };
}

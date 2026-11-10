import type { WorkerActivePaddon, WorkerActivePaddonState } from '../workerActivePaddon';
export type WorkerActivePaddonProps = { state: WorkerActivePaddonState; controller: WorkerActivePaddon; label: string; onOpen?: () => void };

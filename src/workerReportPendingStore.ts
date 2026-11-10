import Storage from 'expo-sqlite/kv-store';

type Request = Record<string, unknown>;
const storageKey = (scope: string) => `worker_report_pending_v1:${scope}`;
let writes: Promise<unknown> = Promise.resolve();
function ordered<T>(action: () => Promise<T>): Promise<T> {
  const result = writes.then(action); writes = result.then(() => undefined, () => undefined); return result;
}
export const workerReportPendingStore = {
  get: (scope: string): Promise<Request | null> => ordered(async () => {
    const saved = await Storage.getItem(storageKey(scope));
    if (saved === null) return null;
    const request: unknown = JSON.parse(saved);
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Saved report is invalid');
    return request as Request;
  }),
  set: (scope: string, request: Request | null, expectedId?: string): Promise<void> => ordered(async () => {
    if (request) await Storage.setItem(storageKey(scope), JSON.stringify(request));
    else {
      const saved = await Storage.getItem(storageKey(scope));
      if (saved !== null && (expectedId === undefined || JSON.parse(saved).request_id === expectedId)) await Storage.removeItem(storageKey(scope));
    }
  }),
};

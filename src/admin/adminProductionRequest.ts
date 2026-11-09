import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';

export type AdminRequestGuard = () => void;
const guards = new WeakMap<AdminRequestGuard, () => void>();
let activeCheck: { reentered: boolean } | null = null;
function suppressReturnedRejection(value: object | Function): void {
  try {
    const handled = Promise.prototype.then.call(value, undefined, () => {});
    void Promise.prototype.then.call(handled, undefined, () => {});
  } catch {
    // Assimilate a non-native thenable, including one whose `then` getter throws.
    try {
      const handled = Promise.resolve(value);
      void Promise.prototype.then.call(handled, undefined, () => {});
    } catch {
      // A hostile Promise constructor can prevent observation; guard still fails closed.
    }
  }
}
/** Reject asynchronous, value-returning or reentrant guards; this does not replace session lifecycle checks. */
export function checkedAdminGuard(guard?: AdminRequestGuard): (() => void) | undefined {
  if (guard == null) return undefined;
  if (typeof guard !== 'function') throw new TypeError('Invalid admin guard');
  const existing = guards.get(guard);
  if (existing) return existing;
  const checked = () => {
    if (activeCheck) { activeCheck.reentered = true; throw new TypeError('Invalid admin guard'); }
    const frame = { reentered: false }; activeCheck = frame;
    try {
      const result: unknown = guard();
      if (result !== undefined) {
        if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
          // Attach a rejection handler before failing, including for non-native thenables.
          suppressReturnedRejection(result);
        }
        throw new TypeError('Invalid admin guard');
      }
      if (frame.reentered) throw new TypeError('Invalid admin guard');
    } finally { activeCheck = null; }
  };
  guards.set(guard, checked); guards.set(checked, checked);
  return checked;
}
/** Opt-in guard around the existing transport; not a replacement for session lifecycle or redirect safety. */
export async function adminProductionRequest(session: Session, url: string, init: RequestInit | undefined, fallback: string,
  guard?: AdminRequestGuard, readWitness?: () => boolean): Promise<unknown> {
  const check = checkedAdminGuard(guard);
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped read requires a guard and witness');
  let response: Response;
  try { response = readWitness ? await authorizedFetch(session, url, init, check, 10_000, { readWitness })
    : await authorizedFetch(session, url, init, check); }
  catch (error) { check?.(); throw error; }
  check?.();
  let value: unknown;
  try { value = await response.json(); }
  catch (error) { check?.(); if (response.status === 200) throw error; value = null; }
  check?.();
  if (response.status !== 200) {
    const error = productionMapResponseError(response.status, value, fallback);
    throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode,
      diagnostics: error.diagnostics, requestId: error.requestId });
  }
  return value;
}

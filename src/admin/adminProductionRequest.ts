import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';

export type AdminRequestGuard = () => void;
/** Opt-in guard around the existing transport; not a replacement for session lifecycle or redirect safety. */
export async function adminProductionRequest(session: Session, url: string, init: RequestInit | undefined, fallback: string,
  guard?: AdminRequestGuard): Promise<unknown> {
  let response: Response;
  try { response = await authorizedFetch(session, url, init, guard); }
  catch (error) { guard?.(); throw error; }
  guard?.();
  let value: unknown;
  try { value = await response.json(); }
  catch (error) { guard?.(); if (response.status === 200) throw error; value = null; }
  guard?.();
  if (response.status !== 200) {
    const error = productionMapResponseError(response.status, value, fallback);
    throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode,
      diagnostics: error.diagnostics, requestId: error.requestId });
  }
  return value;
}

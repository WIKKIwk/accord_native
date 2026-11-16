import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';

/** Preserve direct API callers while scoped screen reads opt into guarded redirect/401 handling. */
export async function additionalSettingsRequest(session: Session, path: string, init?: RequestInit,
  guard?: () => void, readWitness?: () => boolean): Promise<Response> {
  if (readWitness !== undefined && (typeof readWitness !== 'function' || typeof guard !== 'function')) {
    throw new TypeError('Scoped settings read requires a guard and witness');
  }
  guard?.();
  try {
    const response = readWitness === undefined ? await authorizedFetch(session, path, init, guard)
      : await authorizedFetch(session, path, init, guard, 10_000, { readWitness });
    guard?.(); return response;
  } catch (error) { guard?.(); throw error; }
}
export async function additionalSettingsDecode<T>(response: Response, decode: (response: Response) => Promise<T>, guard?: () => void): Promise<T> {
  try { const value = await decode(response); guard?.(); return value; }
  catch (error) { guard?.(); throw error; }
}

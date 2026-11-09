import { fetch } from 'expo/fetch';
import { activeSessionToken, joinRefreshForGuardedRead, refreshSession, type Session } from './auth';

let queueSnapshotReadEpoch = 0;
export const currentQueueSnapshotReadEpoch = (): number => queueSnapshotReadEpoch;
export const invalidateQueueSnapshotReads = (): void => { queueSnapshotReadEpoch++; };

type ReadWitness = () => boolean;
type WitnessGate = { check: () => void; close: () => void };
/** A guarded read could not obtain an independently refreshed session token. */
export class GuardedReadRefreshUnavailable extends Error {
  readonly code = 'guarded_read_refresh_unavailable';
  constructor() { super('Guarded read requires a refreshed session'); this.name = 'GuardedReadRefreshUnavailable'; }
}
const checkingWitnesses = new WeakMap<ReadWitness, { reentered: boolean }>();
function witnessGate(witness: unknown): WitnessGate {
  if (typeof witness !== 'function') throw new Error('read_witness_expired');
  const read = witness as ReadWitness;
  let expired = false;
  const check = () => {
    if (expired) throw new Error('read_witness_expired');
    const previous = checkingWitnesses.get(read);
    if (previous) { previous.reentered = true; expired = true; throw new Error('read_witness_expired'); }
    const frame = { reentered: false }; checkingWitnesses.set(read, frame);
    try {
      const result: unknown = read();
      if (result !== true || frame.reentered) {
        if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
          try { void Promise.resolve(result).catch(() => {}); } catch { /* Invalid results never authorize a send. */ }
        }
        throw new Error('read_witness_expired');
      }
    } catch { expired = true; throw new Error('read_witness_expired'); }
    finally { checkingWitnesses.delete(read); }
  };
  return { check, close: () => { expired = true; } };
}

/** Legacy callers retain their existing behavior; a read witness is an explicit per-request opt-in. */
export async function authorizedFetch(session: Session, path: string, init: RequestInit = {}, beforeSend?: () => void,
  timeoutMs: number | null = 10_000, options?: { readWitness: ReadWitness }): Promise<Response> {
  if (options === undefined) return authenticatedRequest(session, path, init, beforeSend, false, timeoutMs);
  const gate = witnessGate(options?.readWitness);
  try { return await authenticatedRequest(session, path, init, beforeSend, false, timeoutMs, gate); }
  finally { gate.close(); }
}

export async function authorizedImageFetch(session: Session, path: string, init: RequestInit = {}): Promise<Response> {
  return authenticatedRequest(session, path, { ...init, method: 'GET' }, undefined, true, 10_000);
}

async function authenticatedRequest(session: Session, path: string, init: RequestInit, beforeSend: (() => void) | undefined,
  image: boolean, timeoutMs: number | null, gate?: WitnessGate): Promise<Response> {
  const guardedMethod = gate ? (init.method ?? 'GET').toUpperCase() : undefined;
  const mutation = gate ? false : !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase());
  if (gate && !['GET', 'HEAD'].includes(guardedMethod!)) throw new Error('guarded_reads_only');
  if (mutation) invalidateQueueSnapshotReads();
  try {
    const url = new URL(path, session.baseUrl);
    if (url.origin !== session.baseUrl || url.protocol !== 'https:' || url.username || url.password ||
        (!image && !url.pathname.startsWith('/v1/mobile/'))) {
      throw new Error('API manzili noto‘g‘ri.');
    }
    const send = async (token: string) => {
      gate?.check(); beforeSend?.();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const request = (async () => {
        const method = guardedMethod ?? (init.method ?? 'GET').toUpperCase();
        let currentUrl = url, remaining = 5;
        while (true) {
          let response: Response;
          if (gate) {
            const requestUrl = currentUrl.toString();
            const requestInit: RequestInit = { ...init, method: guardedMethod, headers, redirect: 'manual', credentials: 'omit' };
            gate.check();
            response = await fetch(requestUrl, requestInit);
          } else {
            // Preserve the legacy fetch/argument evaluation order exactly.
            response = await fetch(currentUrl.toString(), { ...init, headers, redirect: 'manual', credentials: 'omit' });
          }
          const complete = async () => {
            // V2's non-streamed client buffers the response before its request timeout ends.
            if (timeoutMs != null && typeof response.clone === 'function') await response.clone().arrayBuffer();
            return response;
          };
          if (!['GET', 'HEAD'].includes(method) || ![301, 302, 303, 307, 308].includes(response.status)) {
            return complete();
          }
          const location = response.headers.get('location');
          if (!location) return complete();
          if (response.body) await response.arrayBuffer();
          const destination = new URL(location, currentUrl);
          if (destination.protocol !== 'https:' || !destination.hostname || destination.username || destination.password) {
            throw new TypeError('API redirect requires HTTPS');
          }
          if (remaining-- <= 0) throw new TypeError('Too many API redirects');
          if (destination.origin !== currentUrl.origin) {
            headers.delete('authorization'); headers.delete('cookie'); headers.delete('proxy-authorization');
          }
          currentUrl = destination;
        }
      })();
      if (timeoutMs == null) return request;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([request, new Promise<never>((_, reject) => {
          timer = setTimeout(() => { const error = new Error('API request timed out'); error.name = 'TimeoutError'; reject(error); }, timeoutMs);
        })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
    };
    gate?.check(); const token = activeSessionToken(session);
    if (!token) throw new Error('Sessiya tugagan. Qayta kiring.');
    const first = await send(token);
    gate?.check(); if (!activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
    if (first.status !== 401) return first;
    gate?.check();
    const refreshed = gate ? await joinRefreshForGuardedRead(session, token, gate.check) : await refreshSession(session, token);
    gate?.check();
    if (!refreshed) {
      if (gate) throw new GuardedReadRefreshUnavailable();
      return first;
    }
    const refreshedToken = activeSessionToken(session);
    if (!refreshedToken) return first;
    const retry = await send(refreshedToken);
    gate?.check(); if (!activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
    return retry;
  } finally {
    if (mutation) invalidateQueueSnapshotReads();
  }
}

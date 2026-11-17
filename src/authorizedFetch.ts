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

export async function authorizedImageFetch(session: Session, path: string, init: RequestInit = {},
  options?: { beforeSend: () => void; readWitness: ReadWitness }): Promise<Response> {
  if (options === undefined) return authenticatedRequest(session, path, { ...init, method: 'GET' }, undefined, true, 10_000);
  const gate = witnessGate(options?.readWitness);
  try {
    if (typeof options.beforeSend !== 'function') throw new TypeError('Scoped image read requires its original guard');
    return await authenticatedRequest(session, path, { ...init, method: 'GET' }, options.beforeSend, true, 10_000, gate);
  } finally { gate.close(); }
}

const readTimeoutFacts = new WeakSet<object>(), readClientFailureFacts = new WeakSet<object>();
const legacyTimeoutFacts = new WeakSet<object>(), legacyClientFailureFacts = new WeakSet<object>();
const hasFailureFact = (facts: WeakSet<object>, error: unknown): boolean => error !== null &&
  (typeof error === 'object' || typeof error === 'function') && facts.has(error);
/** Facts originate only at actual timeout/fetch/body boundaries, never from an error's name or message. */
export const isAuthorizedReadTimeout = (error: unknown): boolean => hasFailureFact(readTimeoutFacts, error);
export const isAuthorizedReadClientFailure = (error: unknown): boolean => hasFailureFact(readClientFailureFacts, error);
/** Actual legacy fetch/timer facts, used only by Source Opening WIP delete retry. */
export const isAuthorizedLegacyTimeout = (error: unknown): boolean => hasFailureFact(legacyTimeoutFacts,error);
export const isAuthorizedLegacyClientFailure = (error: unknown): boolean => hasFailureFact(legacyClientFailureFacts,error);
function rawTimeout(message: string): Error {
  const error = new Error(message); error.name = 'TimeoutError'; readTimeoutFacts.add(error); return error;
}
function rawClientError(message: string): Error { const error = new Error(message); readClientFailureFacts.add(error); return error; }
function rememberClientFailure(error: unknown): void {
  if (!isAuthorizedReadTimeout(error) && error !== null && (typeof error === 'object' || typeof error === 'function')) readClientFailureFacts.add(error);
}
async function rawClientBoundary<T>(send: () => Promise<T>): Promise<T> {
  try { return await send(); }
  catch (error) { rememberClientFailure(error); throw error; }
}
// Same UTF-8 replacement and RFC3986 query codec as admin/dartUri. Kept private
// here so opting into this one request adds no dependency to existing callers.
function rawBarcodeQuery(value: string): string {
  let valid = '';
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { valid += value[i] + value[++i]; continue; }
      valid += '\ufffd';
    } else valid += unit >= 0xdc00 && unit <= 0xdfff ? '\ufffd' : value[i];
  }
  return encodeURIComponent(valid).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, '+');
}
const rawMaterialLookupPath = '/v1/mobile/admin/raw-material-assignments/lookup';
const rawMaterialLookupPolicy = Symbol('rawMaterialLookup');
/** A fixed Source transient GET. No caller-supplied path, method, body or timeout is admitted. */
export async function authorizedRawMaterialLookupRead(session: Session, normalizedBarcode: string,
  beforeSend: () => void, readWitness: ReadWitness): Promise<Response> {
  const original = witnessGate(readWitness);
  const gate: WitnessGate = { check: () => { beforeSend(); original.check(); beforeSend(); }, close: original.close };
  try {
    if (typeof normalizedBarcode !== 'string' || typeof beforeSend !== 'function') throw new TypeError('Material lookup requires its original barcode and guard');
    return await authenticatedRequest(session, `${rawMaterialLookupPath}?barcode=${rawBarcodeQuery(normalizedBarcode)}`,
      { method: 'GET' }, beforeSend, false, null, gate, undefined, rawMaterialLookupPolicy);
  } finally { gate.close(); }
}
async function rawLookupAttempt(url: URL, token: string, signal: AbortSignal, check: () => void): Promise<Response> {
  let headers = new Headers({ Authorization: `Bearer ${token}` }), currentUrl = url, remaining = 5;
  while (true) {
    check();
    const response = await rawClientBoundary(() => fetch(currentUrl.toString(), { method: 'GET', headers, redirect: 'manual', credentials: 'omit', signal }));
    check();
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      // Source http.Response.fromStream buffers before the attempt completes.
      const buffered = response.clone(); await rawClientBoundary(() => buffered.arrayBuffer()); check(); return response;
    }
    const location = response.headers.get('location');
    if (!location) { const buffered = response.clone(); await rawClientBoundary(() => buffered.arrayBuffer()); check(); return response; }
    if (response.body) await rawClientBoundary(() => response.arrayBuffer()); check();
    const destination = new URL(location, currentUrl);
    if (destination.protocol !== 'https:' || !destination.hostname || destination.username || destination.password) throw rawClientError('API redirect requires HTTPS');
    if (remaining-- <= 0) throw rawClientError('Too many API redirects');
    const redirectHeaders = new Headers(headers);
    if (destination.origin !== currentUrl.origin) { redirectHeaders.delete('authorization'); redirectHeaders.delete('cookie'); redirectHeaders.delete('proxy-authorization'); }
    headers = redirectHeaders;
    currentUrl = destination;
  }
}
/** @v2 resilientApiRead
 * Each authorized send(token) owns a fresh budget; 401 recovery is outside this loop. */
async function rawLookupRead(url: URL, token: string, check: () => void): Promise<Response> {
  const started = performance.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    check(); const remaining = 15_000 - (performance.now() - started);
    if (remaining <= 0) throw rawTimeout('API read deadline exceeded');
    const controller = new AbortController(); let ended = false, timeoutFailure: Error | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const attemptCheck = () => { check(); if (ended) throw timeoutFailure ?? new Error('API read attempt ended'); };
    try {
      const operation = (async () => {
        const response = await rawLookupAttempt(url, token, controller.signal, attemptCheck); attemptCheck();
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        let html = false;
        if (response.status >= 200 && response.status < 300) {
          if (contentType.includes('text/html')) html = true;
          else if (!contentType) {
            const buffered = response.clone(), body = await rawClientBoundary(() => buffered.text()); attemptCheck();
            html = /^\s*<(?:!doctype\s+html|html)[\s>]/i.test(body);
          }
        }
        attemptCheck(); return { response, html };
      })();
      const result = await Promise.race([operation, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { timeoutFailure = rawTimeout('API read attempt timed out'); ended = true; reject(timeoutFailure); controller.abort(timeoutFailure); }, Math.min(10_000, remaining));
      })]);
      check();
      if (result.html) { if (attempt === 2) throw rawClientError('API returned HTML instead of data'); }
      else if ([502, 503, 504].includes(result.response.status)) { if (attempt === 2) return result.response; }
      else return result.response;
    } catch (error) {
      check();
      const client = isAuthorizedReadClientFailure(error);
      if (attempt === 2 || (!isAuthorizedReadTimeout(error) && !client)) throw error;
      if (client) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('require https') || message.includes('too many api redirects') || message.includes('certificate') || message.includes('handshake')) throw error;
      }
    } finally { ended = true; if (timer !== undefined) clearTimeout(timer); }
    check();
    if (15_000 - (performance.now() - started) <= 150) throw rawTimeout('API read deadline exceeded');
    await new Promise<void>(resolve => setTimeout(resolve, 150)); check();
  }
  throw new Error('API read attempts exhausted');
}

const progressQrReportPath = '/v1/mobile/admin/production-maps/progress-qr/report';
const progressQrReportSnapshotPolicy = Symbol('progressQrReportSnapshot');
const openingWipQrReportPath = '/v1/mobile/admin/production-maps/opening-wip/qr/report';
const openingWipQrReportSnapshotPolicy = Symbol('openingWipQrReportSnapshot');
type ReportSnapshotPolicy = typeof progressQrReportSnapshotPolicy | typeof openingWipQrReportSnapshotPolicy;
const reportSnapshotPath = (policy: ReportSnapshotPolicy | undefined): string | null => policy === progressQrReportSnapshotPolicy ? progressQrReportPath
  : policy === openingWipQrReportSnapshotPolicy ? openingWipQrReportPath : null;
/** This Source POST only reads a report. It cannot authorize an arbitrary guarded POST or carry caller-supplied request options. */
export function authorizedProgressQrReportSnapshot(session: Session, normalizedQrPayload: string,
  beforeSend: () => void, readWitness: ReadWitness): Promise<Response> {
  return authorizedQrReportSnapshot(session, normalizedQrPayload, beforeSend, readWitness, progressQrReportSnapshotPolicy);
}
/** Source opening-WIP fallback report has its own fixed path and private operation capability. */
export function authorizedOpeningWipQrReportSnapshot(session: Session, normalizedQrPayload: string,
  beforeSend: () => void, readWitness: ReadWitness): Promise<Response> {
  return authorizedQrReportSnapshot(session, normalizedQrPayload, beforeSend, readWitness, openingWipQrReportSnapshotPolicy);
}
async function authorizedQrReportSnapshot(session: Session, normalizedQrPayload: string,
  beforeSend: () => void, readWitness: ReadWitness, policy: ReportSnapshotPolicy): Promise<Response> {
  const original = witnessGate(readWitness);
  // Recovery and buffered responses must obey the narrower original scope guard,
  // even when the independently supplied account witness remains true.
  const gate: WitnessGate = { check: () => { beforeSend(); original.check(); beforeSend(); }, close: original.close };
  try {
    if (typeof normalizedQrPayload !== 'string' || typeof beforeSend !== 'function') throw new TypeError('Report snapshot requires its original payload and guard');
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr_payload: normalizedQrPayload }) };
    return await authenticatedRequest(session, reportSnapshotPath(policy)!, init, beforeSend, false, 10_000, gate, policy);
  } finally { gate.close(); }
}

async function authenticatedRequest(session: Session, path: string, init: RequestInit, beforeSend: (() => void) | undefined,
  image: boolean, timeoutMs: number | null, gate?: WitnessGate, snapshotPolicy?: ReportSnapshotPolicy,
  rawPolicy?: typeof rawMaterialLookupPolicy): Promise<Response> {
  const guardedMethod = gate ? (init.method ?? 'GET').toUpperCase() : undefined;
  const snapshotPath = reportSnapshotPath(snapshotPolicy);
  const reportSnapshot = !!gate && snapshotPath !== null && guardedMethod === 'POST' && !image && typeof beforeSend === 'function';
  const mutation = gate ? false : !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase());
  if (gate && !['GET', 'HEAD'].includes(guardedMethod!) && !reportSnapshot) throw new Error('guarded_reads_only');
  if (mutation) invalidateQueueSnapshotReads();
  try {
    const url = new URL(path, session.baseUrl);
    if (snapshotPolicy !== undefined && (!reportSnapshot || path !== snapshotPath || url.pathname !== snapshotPath || url.search || url.hash)) throw new Error('guarded_reads_only');
    const rawLookup = rawPolicy === rawMaterialLookupPolicy && !!gate && guardedMethod === 'GET' && !image && typeof beforeSend === 'function';
    if (rawPolicy !== undefined && (!rawLookup || url.pathname !== rawMaterialLookupPath || !/^\?barcode=[A-Za-z0-9._~%+-]*$/.test(url.search) || url.hash || path !== url.pathname + url.search)) throw new Error('guarded_reads_only');
    if (url.origin !== session.baseUrl || url.protocol !== 'https:' || url.username || url.password ||
        (!image && !url.pathname.startsWith('/v1/mobile/'))) {
      throw new Error('API manzili noto‘g‘ri.');
    }
    const send = async (token: string) => {
      gate?.check(); beforeSend?.();
      if (rawLookup) return rawLookupRead(url, token, gate!.check);
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      // Source _post wraps even this read-only report in _mutationRequest.
      // Its cache epoch changes for EACH authorized attempt, including retries.
      if (reportSnapshot) invalidateQueueSnapshotReads();
      try {
        const request = (async () => {
          const method = guardedMethod ?? (init.method ?? 'GET').toUpperCase();
          let currentUrl = url, remaining = 5;
          while (true) {
            let response: Response;
            if (gate) {
              const requestUrl = currentUrl.toString();
              const requestInit: RequestInit = { ...init, method: guardedMethod, headers, redirect: 'manual', credentials: 'omit' };
              gate.check();
              try { response = await fetch(requestUrl, requestInit); }
              catch (error) { rememberClientFailure(error); throw error; }
            } else {
              // Preserve the legacy fetch/argument evaluation order exactly.
              try { response = await fetch(currentUrl.toString(), { ...init, headers, redirect: 'manual', credentials: 'omit' }); }
              catch (error) { if (error !== null && (typeof error === 'object' || typeof error === 'function')) legacyClientFailureFacts.add(error); throw error; }
            }
            const complete = async () => {
              // V2's non-streamed client buffers the response before its request timeout ends.
              if (timeoutMs != null && typeof response.clone === 'function') {
                if (gate) { const buffered = response.clone(); await rawClientBoundary(() => buffered.arrayBuffer()); }
                else await response.clone().arrayBuffer();
              }
              return response;
            };
            if (!['GET', 'HEAD'].includes(method) || ![301, 302, 303, 307, 308].includes(response.status)) {
              return complete();
            }
            const location = response.headers.get('location');
            if (!location) return complete();
            if (response.body) {
              if (gate) await rawClientBoundary(() => response.arrayBuffer()); else await response.arrayBuffer();
            }
            const destination = new URL(location, currentUrl);
            if (destination.protocol !== 'https:' || !destination.hostname || destination.username || destination.password) {
              const error = new TypeError('API redirect requires HTTPS'); if (gate) rememberClientFailure(error); throw error;
            }
            if (remaining-- <= 0) { const error = new TypeError('Too many API redirects'); if (gate) rememberClientFailure(error); throw error; }
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
            timer = setTimeout(() => { const error = new Error('API request timed out'); error.name = 'TimeoutError'; if (gate) readTimeoutFacts.add(error); else legacyTimeoutFacts.add(error); reject(error); }, timeoutMs);
          })]);
        } finally { if (timer !== undefined) clearTimeout(timer); }
      } finally { if (reportSnapshot) invalidateQueueSnapshotReads(); }
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

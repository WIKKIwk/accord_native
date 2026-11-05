import { activeSessionToken, refreshSession, type Session } from './auth';

let queueSnapshotReadEpoch = 0;
export const currentQueueSnapshotReadEpoch = (): number => queueSnapshotReadEpoch;
export const invalidateQueueSnapshotReads = (): void => { queueSnapshotReadEpoch++; };

/** Authenticated API request with a single retry after a successful 401 refresh. */
export async function authorizedFetch(session: Session, path: string, init: RequestInit = {}, beforeSend?: () => void,
  timeoutMs: number | null = 10_000): Promise<Response> {
  return authenticatedRequest(session, path, init, beforeSend, false, timeoutMs);
}

export async function authorizedImageFetch(session: Session, path: string, init: RequestInit = {}): Promise<Response> {
  return authenticatedRequest(session, path, { ...init, method: 'GET' }, undefined, true, 10_000);
}

async function authenticatedRequest(session: Session, path: string, init: RequestInit, beforeSend: (() => void) | undefined,
  image: boolean, timeoutMs: number | null): Promise<Response> {
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase());
  if (mutation) invalidateQueueSnapshotReads();
  try {
    const url = new URL(path, session.baseUrl);
    if (url.origin !== session.baseUrl || url.protocol !== 'https:' || (!image && !url.pathname.startsWith('/v1/mobile/'))) {
      throw new Error('API manzili noto‘g‘ri.');
    }
    const send = async (token: string) => {
      beforeSend?.();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const request = fetch(url.toString(), { ...init, headers });
      if (timeoutMs == null) return request;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([request, new Promise<never>((_, reject) => {
          timer = setTimeout(() => { const error = new Error('API request timed out'); error.name = 'TimeoutError'; reject(error); }, timeoutMs);
        })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
    };
    const token = activeSessionToken(session);
    if (!token) throw new Error('Sessiya tugagan. Qayta kiring.');
    const first = await send(token);
    if (!activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
    if (first.status !== 401 || !(await refreshSession(session, token))) return first;
    const refreshedToken = activeSessionToken(session);
    if (!refreshedToken) return first;
    const retry = await send(refreshedToken);
    if (!activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
    return retry;
  } finally {
    if (mutation) invalidateQueueSnapshotReads();
  }
}

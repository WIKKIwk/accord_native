import { activeSessionToken, refreshSession, type Session } from './auth';

/** Authenticated API request with a single retry after a successful 401 refresh. */
export async function authorizedFetch(session: Session, path: string, init: RequestInit = {}, beforeSend?: () => void): Promise<Response> {
  const url = new URL(path, session.baseUrl);
  if (url.origin !== session.baseUrl || url.protocol !== 'https:' || !url.pathname.startsWith('/v1/mobile/')) {
    throw new Error('API manzili noto‘g‘ri.');
  }
  const send = (token: string) => {
    beforeSend?.();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url.toString(), { ...init, headers });
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
}

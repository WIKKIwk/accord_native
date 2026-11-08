import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';

export type ScopedReadOptions = {
  /** Must synchronously verify the caller's current route, role and capability. */
  isCurrent: () => boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * Experimental opt-in GET transport. It is not wired to any role.
 * It fails closed on 401, never refreshes credentials, accepts only same-origin
 * /v1/mobile/ redirects, and explicitly uses Expo fetch with cookies omitted.
 * Callers must check their session and scope again after parsing the response.
 * See the status file for native and session-lifetime limits before using it.
 */
export async function scopedRead(session: Session, path: string, options: ScopedReadOptions): Promise<Response> {
  const token = activeSessionToken(session), epoch = activeSessionEpoch(session);
  if (!token || epoch === null) throw new Error('Sessiya tugagan. Qayta kiring.');
  const scope = sessionReadScope(session), base = session.baseUrl;
  let origin: URL;
  try { origin = new URL(base); } catch { throw new Error('API manzili noto‘g‘ri.'); }
  if (origin.protocol !== 'https:' || origin.origin !== base || origin.username || origin.password || origin.hash || origin.search) {
    throw new Error('API manzili noto‘g‘ri.');
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new TypeError('Invalid read timeout');
  // Reject encoded or non-ASCII path segments until backend/proxy decoding is
  // characterized. Query encoding is allowed; this is intentionally narrower
  // than the legacy transport.
  const validUrl = (url: URL) => url.protocol === 'https:' && url.origin === origin.origin && !url.username && !url.password &&
    !url.hash && /^\/v1\/mobile\/[A-Za-z0-9._~/-]*$/.test(url.pathname);
  let first: URL;
  try { first = new URL(path, origin); } catch { throw new Error('API manzili noto‘g‘ri.'); }
  if (!validUrl(first)) throw new Error('API manzili noto‘g‘ri.');

  const controller = new AbortController(); let stopped = false, completed = false;
  let rejectInterrupted: (error: Error) => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => { rejectInterrupted = reject; });
  const stop = (error: Error) => {
    if (stopped) return;
    stopped = true; controller.abort(); rejectInterrupted(error);
  };
  const onAbort = () => stop(new Error('Request cancelled'));
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => stop(new Error('Request timed out')), timeoutMs);
  const check = () => {
    if (stopped) throw new Error('Sessiya o‘zgardi. Qayta urining.');
    const allowed: unknown = options.isCurrent();
    if (allowed !== true) {
      // A mistakenly async guard must not become an unhandled rejection or be trusted.
      if (allowed && typeof allowed === 'object' && 'then' in allowed) void Promise.resolve(allowed).catch(() => {});
      throw new Error('Sessiya o‘zgardi. Qayta urining.');
    }
    // The caller's callback can itself change state; check the snapshot after it.
    if (stopped || activeSessionToken(session) !== token || activeSessionEpoch(session) !== epoch ||
        sessionReadScope(session) !== scope) throw new Error('Sessiya o‘zgardi. Qayta urining.');
  };
  const operation = async () => {
    check();
    // Explicit Expo fetch is deliberate: the optional RN global-fetch override
    // does not reliably honor manual redirect handling on all platforms.
    const { fetch: expoFetch } = await import('expo/fetch');
    check();
    let current = first, remaining = 5;
    while (true) {
      check();
      const response = await expoFetch(current.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit', redirect: 'manual', signal: controller.signal });
      check();
      let actual: URL;
      try { actual = new URL(response.url); } catch { throw new Error('API javob manzili noto‘g‘ri.'); }
      // Detection after the fact is not proof that native code could not have
      // followed a redirect; native manual-redirect behavior still needs testing.
      if (!validUrl(actual) || actual.toString() !== current.toString()) throw new Error('API javob manzili noto‘g‘ri.');
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          let next: URL;
          try { next = new URL(location, current); } catch { throw new Error('API redirect manzili noto‘g‘ri.'); }
          if (!validUrl(next)) throw new Error('API redirect manzili noto‘g‘ri.');
          if (remaining-- <= 0) throw new Error('Too many API redirects');
          if (response.body) { await response.arrayBuffer(); check(); }
          current = next;
          continue;
        }
      }
      // Finish the body within the same deadline and scope; consumers must
      // still recheck after their own asynchronous parse before applying it.
      await response.clone().arrayBuffer(); check();
      return response;
    }
  };
  try {
    const response = await Promise.race([operation(), interrupted]);
    completed = true; return response;
  } finally {
    clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort);
    if (!completed) { stopped = true; controller.abort(); }
  }
}

import type { Session } from '../auth';

/** @v2 loginFailureMessage */
export function loginFailureMessage(error: unknown, messages: { loginConnectionFailed: string; loginFailed: string }): string {
  const exception = error instanceof Error ? error : null;
  const connectionFailure = exception?.name === 'TimeoutError' || exception?.name === 'AbortError' ||
    exception?.name === 'NetworkError' || (exception instanceof TypeError &&
      /failed to fetch|fetch failed|network request failed|networkerror|load failed|net::err_/i.test(exception.message));
  return connectionFailure ? messages.loginConnectionFailed : messages.loginFailed;
}

/** @v2 loginCodeUsesNumericKeyboard */
export function loginCodeUsesNumericKeyboard(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.length < 2 || ['40', '50', '80', '92'].includes(trimmed.substring(0, 2));
}

/** @v2 AppEntryScreen._bootstrap */
export async function bootstrapSession(
  load: () => Promise<Session | null>,
  refresh: (session: Session) => Promise<unknown>,
  isActive: (session: Session) => boolean,
  timeoutMs = 2000,
): Promise<Session | null> {
  const session = await load();
  if (!session) return null;
  if (session.token !== 'test-mode-token') {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([refresh(session), new Promise<void>(resolve => { timeout = setTimeout(resolve, timeoutMs); })]);
    } catch { /* V2 keeps a locally valid session when refreshing fails. */ }
    finally { if (timeout !== undefined) clearTimeout(timeout); }
  }
  return isActive(session) ? session : null;
}

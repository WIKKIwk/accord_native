/** Optional synchronous witness check. An absent guard preserves legacy callers. */
export type ProfileSessionGuard = () => boolean;
let checking: { reentered: boolean } | null = null;
function suppressRejection(value: object | Function): void {
  try {
    const handled = Promise.prototype.then.call(value, undefined, () => {});
    void Promise.prototype.then.call(handled, undefined, () => {});
  } catch {
    try { const handled = Promise.resolve(value); void Promise.prototype.then.call(handled, undefined, () => {}); }
    catch { /* A hostile Promise constructor can prevent observation; the guard still fails closed. */ }
  }
}
export function isProfileSessionCurrent(guard?: ProfileSessionGuard): boolean {
  if (guard == null) return true;
  if (typeof guard !== 'function') return false;
  if (checking) { checking.reentered = true; return false; }
  const frame = { reentered: false }; checking = frame;
  try {
    const result: unknown = guard();
    if (result !== true) {
      if (result !== null && (typeof result === 'object' || typeof result === 'function')) suppressRejection(result);
      return false;
    }
    return !frame.reentered;
  } catch { return false; }
  finally { checking = null; }
}
export function assertProfileSessionCurrent(guard?: ProfileSessionGuard): void {
  if (!isProfileSessionCurrent(guard)) throw new Error('Profile session changed');
}

/** The opt-in consumer must not install a response for a different account. */
export function assertProfileIdentity(session: { profile: Record<string, unknown> }, profile: Record<string, unknown>): void {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const oldRef = text(session.profile.ref), oldRole = text(session.profile.role);
  if (!oldRef || !oldRole || text(profile.ref) !== oldRef || text(profile.role) !== oldRole) throw new Error('Profile identity changed');
}

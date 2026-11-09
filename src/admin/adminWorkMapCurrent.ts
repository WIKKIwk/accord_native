let checking: { reentered: boolean } | null = null;
/** Validate one synchronous raw witness without nesting the shared strict validator. */
export function adminWorkMapCurrent(witness: () => boolean): boolean {
  if (checking) { checking.reentered = true; return false; }
  const frame = { reentered: false }; checking = frame;
  try {
    const value: unknown = witness();
    if (value === true) return !frame.reentered;
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      try {
        const handled = Promise.prototype.then.call(value, undefined, () => {});
        void Promise.prototype.then.call(handled, undefined, () => {});
      } catch {
        try { const handled = Promise.resolve(value); void Promise.prototype.then.call(handled, undefined, () => {}); }
        catch { /* A malformed witness never authorizes work. */ }
      }
    }
  } catch { /* A throwing witness never authorizes work. */ }
  finally { checking = null; }
  return false;
}

/** Only a synchronous true is authorization. Never treat an accidentally returned Promise as true. */
export function isSynchronouslyTrue(read: () => boolean): boolean {
  try {
    const result: unknown = read();
    if (result === true) return true;
    if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
      // An accidentally async guard must not cause an unhandled rejection or authorize camera events.
      void Promise.resolve(result).catch(() => {});
    }
    return false;
  } catch { return false; }
}

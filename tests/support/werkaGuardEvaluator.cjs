// Test-only evaluator, not a production fallback. Integration must use a reviewed evaluator
// bound to the real account, read scope and generation and recheck after invoking the guard.
function testWerkaGuardEvaluator(guard) {
  try {
    const result = guard();
    if (result === true) return true;
    if (result !== null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
    return false;
  } catch { return false; }
}
module.exports = {testWerkaGuardEvaluator};

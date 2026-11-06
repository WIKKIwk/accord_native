export type SecurityLifecycle = { wasBackgrounded: boolean; suspendResumeLock: boolean };
type Change = { state: SecurityLifecycle; shield: boolean | null; lock: boolean; clearInput: boolean; incrementEpoch: boolean };

/** @v2 SecurityController.didChangeAppLifecycleState */
export function securityLifecycleChange(state: SecurityLifecycle, appState: string, hasPin: boolean, authenticating: boolean): Change {
  const unchanged: Change = { state, shield: null, lock: false, clearInput: false, incrementEpoch: false };
  if (authenticating) return unchanged;
  if (appState === 'inactive' || appState === 'background') {
    return { state: { ...state, wasBackgrounded: true }, shield: hasPin ? true : null,
      lock: false, clearInput: false, incrementEpoch: hasPin };
  }
  if (appState !== 'active') return unchanged;
  if (state.suspendResumeLock) {
    return { state: { wasBackgrounded: false, suspendResumeLock: false }, shield: false,
      lock: false, clearInput: false, incrementEpoch: false };
  }
  if (!state.wasBackgrounded) return unchanged;
  return { state: { ...state, wasBackgrounded: false }, shield: false,
    lock: hasPin, clearInput: true, incrementEpoch: false };
}

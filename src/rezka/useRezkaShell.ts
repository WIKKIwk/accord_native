import { useEffect, useState, useSyncExternalStore } from 'react';
import { clearAppLock } from '../appLock';
import { loadSession, logout, registerSessionResetHook, sessionWitnessTransitioning, subscribeSessionWitness, type Session } from '../auth';
import { localeController } from '../shared/localization/runtime';
import { switchPinStore } from '../shared/switchPinRuntime';
import { captureRezkaSession, isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { canEnterRezkaShell } from './rezkaShellModel';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaLocale() { return useSyncExternalStore(subscribeLocale, currentLocale, currentLocale); }
export type RezkaShellSession = RezkaSessionSnapshot | 'test-token-unavailable' | 'transition-pending' | null | undefined;

/** Capture once per mounted shell, subscribe and recheck; an invalidated shell never recaptures. */
export function useRezkaShellSession(): RezkaShellSession {
  const [snapshot, setSnapshot] = useState<RezkaShellSession>(undefined);
  useEffect(() => {
    let mounted = true, terminal = false, pending = false, reloadAfter = false, revision = 0;
    let captured: RezkaSessionSnapshot | null = null;
    const attempt = () => {
      if (!mounted || terminal || pending || captured) return;
      if (sessionWitnessTransitioning()) { setSnapshot('transition-pending'); return; }
      pending = true; const started = revision;
      void loadSession().then(session => {
        if (!mounted || terminal || started !== revision) return;
        if (sessionWitnessTransitioning()) { reloadAfter = true; setSnapshot('transition-pending'); return; }
        if (!canEnterRezkaShell(session)) { terminal = true; setSnapshot(null); return; }
        if (session.token === 'test-mode-token') { setSnapshot('test-token-unavailable'); return; }
        const candidate = captureRezkaSession(session);
        if (!isRezkaSessionCurrent(candidate, 'master')) { terminal = true; setSnapshot(null); return; }
        captured = candidate;
        if (isRezkaSessionCurrent(candidate, 'master')) setSnapshot(candidate);
        else { terminal = true; captured = null; setSnapshot(null); }
      }).catch(() => { if (mounted && !terminal && started === revision) { terminal = true; setSnapshot(null); } }).finally(() => {
        pending = false;
        if (mounted && !terminal && !captured && reloadAfter && !sessionWitnessTransitioning()) { reloadAfter = false; attempt(); }
      });
    };
    const unregister = registerSessionResetHook(async () => { revision++; terminal = true; if (mounted) setSnapshot(null); });
    const unwatch = subscribeSessionWitness(() => {
      if (!mounted || terminal) return;
      if (captured) {
        if (!isRezkaSessionCurrent(captured, 'master')) { terminal = true; captured = null; setSnapshot(null); }
      } else if (sessionWitnessTransitioning()) {
        revision++; reloadAfter = true; setSnapshot('transition-pending');
      } else if (pending) reloadAfter = true;
      else attempt();
    });
    attempt();
    return () => { mounted = false; unregister(); unwatch(); };
  }, []);
  return snapshot;
}

/** Match the existing root's cleanup without changing Worker logout behavior. */
export function logoutRezkaSession(session: Session, finished: () => void): void {
  void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {}),
    switchPinStore.clear(session).catch(() => {})]).finally(finished);
}

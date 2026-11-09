import { useEffect, useState, useSyncExternalStore } from 'react';
import { currentSession, loadSession, logout, registerSessionResetHook, sessionWitnessTransitioning, subscribeSessionWitness } from '../auth';
import { localeController } from '../shared/localization/runtime';
import { captureRezkaSession, isRezkaSessionCurrent, type RezkaAccess, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { canEnterRezkaShell } from './rezkaShellModel';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaLocale() { return useSyncExternalStore(subscribeLocale, currentLocale, currentLocale); }
export type RezkaShellSession = RezkaSessionSnapshot | 'test-token-unavailable' | 'transition-pending' | null | undefined;

/** Capture once per mounted shell, subscribe and recheck; an invalidated shell never recaptures. */
export function useRezkaShellSession(access: RezkaAccess = 'master'): RezkaShellSession {
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
        if (!session || !(access === 'master' ? canEnterRezkaShell(session) : canOpenRoute(session, appRoutes.rezkaSplit))) { terminal = true; setSnapshot(null); return; }
        if (session.token === 'test-mode-token') { setSnapshot('test-token-unavailable'); return; }
        const candidate = captureRezkaSession(session);
        if (!isRezkaSessionCurrent(candidate, access)) { terminal = true; setSnapshot(null); return; }
        captured = candidate;
        if (isRezkaSessionCurrent(candidate, access)) setSnapshot(candidate);
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
        if (!isRezkaSessionCurrent(captured, access)) { terminal = true; captured = null; setSnapshot(null); }
      } else if (sessionWitnessTransitioning()) {
        revision++; reloadAfter = true; setSnapshot('transition-pending');
      } else if (pending) reloadAfter = true;
      else attempt();
    });
    attempt();
    return () => { mounted = false; unregister(); unwatch(); };
  }, [access]);
  return snapshot;
}

/** Do not let a queued old-account dialog or a late completion affect a new session. */
export function logoutRezkaSession(snapshot: RezkaSessionSnapshot, finished: () => void): boolean {
  if (!isRezkaSessionCurrent(snapshot, 'master')) return false;
  void logout(snapshot.session).catch(() => {}).finally(() => {
    if (!currentSession() && !sessionWitnessTransitioning()) finished();
  });
  return true;
}

import { useEffect, useState } from 'react';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, loadSession, registerSessionResetHook,
  subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminShellMayEnter } from './adminShellAccess';

export type AdminShellAdmission = { session: Session; witness: SessionWitness };
/** Capture only once per fresh gate. A transition invalidates the old gate, never recaptures its work. */
export function useAdminShellSession(): AdminShellAdmission | null | undefined {
  const [admission, setAdmission] = useState<AdminShellAdmission | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true, generation = 0, captured: SessionWitness | null = null;
    const invalidate = () => { generation++; if (mounted) setAdmission(undefined); };
    const unsubscribe = subscribeSessionWitness(() => { if (captured && !isSessionWitnessCurrent(captured)) invalidate(); });
    const unregister = registerSessionResetHook(async () => { invalidate(); });
    const started = generation;
    void loadSession().then(session => {
      if (!mounted || generation !== started) return;
      if (!session || !activeSessionToken(session) || !adminShellMayEnter(session)) { setAdmission(null); return; }
      const witness = captureSessionWitness(session);
      if (!witness || !isSessionWitnessCurrent(witness)) return; // wait for a newly mounted gate after transition
      captured = witness;
      if (!isSessionWitnessCurrent(witness)) { invalidate(); return; } // subscribe, then recheck
      setAdmission({ session, witness });
    }).catch(() => { if (mounted && generation === started) setAdmission(null); });
    return () => { mounted = false; generation++; captured = null; unsubscribe(); unregister(); };
  }, []);
  return admission;
}

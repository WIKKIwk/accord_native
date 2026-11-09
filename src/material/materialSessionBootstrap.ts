import { captureSessionWitness, isSessionWitnessCurrent, loadSession, sessionWitnessTransitioning,
  sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';

export type MaterialSession = { session: Session; witness: SessionWitness };

/** A new shell waits for tracked transitions; a settled shell never recaptures its witness. */
export function startMaterialSessionBootstrap(onSettled: (value: MaterialSession | null) => void) {
  let live = true, settled = false, running = false, dirty = false;
  const finish = (value: MaterialSession | null) => {
    if (!live || settled) return;
    settled = true; onSettled(value);
  };
  const attempt = async () => {
    if (!live || settled || running || sessionWitnessTransitioning()) return;
    running = true;
    const version = sessionWitnessVersion();
    try {
      const session = await loadSession();
      if (!live || settled) return;
      if (dirty || sessionWitnessTransitioning() || version !== sessionWitnessVersion()) { dirty = true; return; }
      const witness = captureSessionWitness(session);
      if (dirty || sessionWitnessTransitioning() || version !== sessionWitnessVersion()) { dirty = true; return; }
      finish(session && witness && isSessionWitnessCurrent(witness) ? { session, witness } : null);
    } catch {
      if (!live || settled) return;
      if (sessionWitnessTransitioning() || version !== sessionWitnessVersion()) dirty = true;
      else finish(null);
    } finally {
      running = false;
      if (dirty && live && !settled && !sessionWitnessTransitioning()) { dirty = false; void attempt(); }
    }
  };
  const retry = () => {
    if (!live || settled) return;
    dirty = true;
    if (!running && !sessionWitnessTransitioning()) { dirty = false; void attempt(); }
  };
  // Subscribe first and then read the transition state in retry, so completion cannot be missed.
  const unsubscribe = subscribeSessionWitness(retry);
  retry();
  return { retry, stop: () => { live = false; unsubscribe(); } };
}

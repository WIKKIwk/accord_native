import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, subscribeSessionWitness,
  type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { BoyoqchiRequestsController } from './boyoqchiController';
import { boyoqchiReturnedPaintRequests } from './returnedPaintApi';

class RequestsResource {
  private enabled = false;
  private abort: AbortController | null = null;
  private unsubscribe: (() => void) | null = null;
  readonly controller: BoyoqchiRequestsController;
  constructor(private readonly session: Session, home: boolean, private readonly witness: SessionWitness,
    private readonly epoch: number | null, private readonly scope: string) {
    const beforeSend = () => { if (!this.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.'); };
    this.controller = new BoyoqchiRequestsController(
      () => boyoqchiReturnedPaintRequests(session, 100, 0, { beforeSend, signal: this.abort?.signal }),
      home ? () => adminApparatus(session, { limit: 10000, signal: this.abort?.signal }) : null, () => this.isCurrent());
  }
  private isCurrent(): boolean {
    try { const token = activeSessionToken(this.session);
      return this.enabled && this.witness.session === this.session && isSessionWitnessCurrent(this.witness) && this.epoch !== null &&
        activeSessionEpoch(this.session) === this.epoch && !!token && token !== 'test-mode-token' && sessionReadScope(this.session) === this.scope;
    } catch { return false; }
  }
  start(): void {
    this.enabled = true; this.abort = new AbortController();
    this.unsubscribe = subscribeSessionWitness(() => { if (!this.isCurrent()) this.abort?.abort(); });
    if (!this.isCurrent()) this.abort.abort(); // Covers a transition immediately before subscription.
  }
  stop(): void {
    this.enabled = false; this.unsubscribe?.(); this.unsubscribe = null;
    this.abort?.abort(); this.abort = null; this.controller.cancelPending();
  }
}
export function useBoyoqchiRequests(session: Session, home: boolean, witness: SessionWitness) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  const resource = useMemo(() => new RequestsResource(session, home, witness, epoch, scope), [session, home, witness, epoch, scope]);
  const { controller } = resource;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    resource.start();
    void controller.refresh();
    if (home) void controller.refreshApparatus();
    return () => resource.stop();
  }, [resource, controller, home]);
  return { state, controller };
}

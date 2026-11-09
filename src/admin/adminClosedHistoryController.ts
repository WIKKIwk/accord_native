import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { MobileApiException } from '../shared/mobileApiException';
import type { closedProductionOrderFromJson } from '../workerClosedOrders';
import { adminWorkMapClosedTime } from './adminWorkMapClosedModel';

export type AdminClosedHistoryTicket = { id: string; historyVersion: string; windowGeneration: number };
type Detail = ReturnType<typeof closedProductionOrderFromJson>;
export type AdminClosedHistoryState = { ticket: AdminClosedHistoryTicket; expanded: boolean; loading: boolean; detail: Detail | null; error: string | null };
type Dependencies = { isCurrent: () => boolean; rowIsCurrent: (ticket: AdminClosedHistoryTicket) => boolean;
  read: (id: string, witness: () => boolean) => Promise<Detail> };

/** Unconnected Closed-row lifecycle. The owning window must supply raw account and row-version witnesses. */
export class AdminClosedHistoryController {
  private state: AdminClosedHistoryState;
  private hidden: AdminClosedHistoryState;
  private generation = 0;
  private flight: object | null = null;
  private disposed = false;
  private listeners = new Set<() => void>();
  constructor(ticket: AdminClosedHistoryTicket, private readonly deps: Dependencies) {
    this.state = { ticket: { ...ticket }, expanded: false, loading: false, detail: null, error: null };
    this.hidden = { ...this.state };
  }
  private witness(generation: number, ticket: AdminClosedHistoryTicket) {
    return () => {
      const account = this.deps.isCurrent();
      // Preserve malformed/async results so the outer strict validator rejects and observes them.
      if (account !== true) return account;
      if (this.disposed || generation !== this.generation || ticket !== this.state.ticket) return false;
      return this.deps.rowIsCurrent(ticket);
    };
  }
  private current(generation = this.generation, ticket = this.state.ticket) {
    return isProfileSessionCurrent(this.witness(generation, ticket));
  }
  getSnapshot = () => this.current() ? this.state : this.hidden;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminClosedHistoryState>) {
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  configure(ticket: AdminClosedHistoryTicket) {
    if (this.disposed) return;
    if (ticket.id === this.state.ticket.id && ticket.historyVersion === this.state.ticket.historyVersion && ticket.windowGeneration === this.state.ticket.windowGeneration) {
      if (this.state.expanded && !this.state.error) this.load();
      return;
    }
    this.generation++;
    const next = { ...ticket };
    this.hidden = { ticket: next, expanded: false, loading: false, detail: null, error: null };
    this.publish({ ticket: next, detail: null, error: null, loading: this.state.expanded && !!this.flight });
    if (this.state.expanded) this.load();
  }
  toggle() {
    if (!this.current()) return;
    const expanded = !this.state.expanded;
    this.publish({ expanded, ...(expanded && this.flight && !this.state.detail ? { loading: true } : {}) });
    if (expanded) this.load();
  }
  retry() { if (this.state.expanded && this.state.error && this.current()) this.load(); }
  private load() {
    if (!this.state.expanded || this.state.detail || this.flight || !this.current()) return;
    const ticket = this.state.ticket, generation = this.generation, flight = {};
    this.flight = flight; this.publish({ loading: true, error: null });
    const witness = this.witness(generation, ticket);
    let request: Promise<Detail>;
    try { request = Promise.resolve(this.deps.read(ticket.id, witness)); }
    catch (error) { request = Promise.reject(error); }
    void request.then(detail => {
      if (!this.current(generation, ticket)) return;
      // Do not put another order's response into this row; V2's endpoint can omit history_version.
      try {
        if (detail.order_id !== ticket.id) throw new Error('Closed history identity mismatch');
        adminWorkMapClosedTime(detail.completed_at_unix ?? 0);
        for (const log of detail.logs) {
          adminWorkMapClosedTime(log.created_at_unix ?? 0);
          if (log.freeze) { adminWorkMapClosedTime(log.freeze.requested_at_unix ?? 0); adminWorkMapClosedTime(log.freeze.transitioned_at_unix ?? 0); }
        }
      } catch { this.publish({ detail: null, error: 'Tarix yuklanmadi' }); return; }
      this.publish({ detail, error: null });
    }, error => {
      if (this.current(generation, ticket)) this.publish({ detail: null, error: error instanceof MobileApiException ? error.message : 'Tarix yuklanmadi' });
    }).finally(() => {
      if (this.flight !== flight) return;
      this.flight = null;
      if (this.disposed) return;
      if (generation === this.generation && ticket === this.state.ticket) this.publish({ loading: false });
      else if (this.state.expanded && this.current()) this.load();
      else this.publish({ loading: false });
    });
  }
  invalidate() {
    if (this.disposed) return;
    this.generation++; this.publish({ expanded: false, loading: false, detail: null, error: null });
  }
  dispose() { this.invalidate(); this.disposed = true; this.listeners.clear(); }
}

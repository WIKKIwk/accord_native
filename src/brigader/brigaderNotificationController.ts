import { dartFutureWait } from '../shared/dartFutureWait';
import type { Session } from '../auth';
import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { adminProductionMapCompletionRequestDecision, adminProductionMapCompletionRequests } from '../productionCompletionApi';
import { adminProductionMapNotificationEvents } from '../productionMapNotifications';
import { adminText, productionText } from '../shared/localization';
import { dailyWorkDate } from '../dailyWork';

type Request = Record<string, unknown>;
type State = { loading: boolean; error: unknown; requests: Request[]; catalog: AdminApparatus[]; expanded: string | null; deciding: ReadonlySet<string> };
/** V2 AdminNotificationsScreen, including disconnected-only HTTP fallback and live/read races. */
export class BrigaderNotifications {
  private state: State = { loading: true, error: null, requests: [], catalog: [], expanded: null, deciding: new Set() };
  private readonly listeners = new Set<() => void>();
  private leases = 0; private disposed = false; private foreground = true; private catalogLoaded = false;
  private requestsVersion = 0; private loading: Promise<void> | null = null; private liveGeneration = 0; private retryAttempt = 0;
  private stopFeed: (() => void) | null = null; private retry: ReturnType<typeof setTimeout> | null = null; private first: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly session: Session, private readonly current: () => boolean, private readonly interactive: () => boolean,
    private readonly notice: (message: string, tone: 'success' | 'error') => void, private readonly locale: () => string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private active = () => !this.disposed && this.leases > 0 && this.current();
  private update(patch: Partial<State>) { if (this.active()) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  attach() { this.leases++; void this.load(); this.connect(); return () => { this.leases--; queueMicrotask(() => { if (!this.leases) this.dispose(); }); }; }
  dispose() { this.disposed = true; this.stopLive(); }
  load = (): Promise<void> => {
    if (!this.active()) return Promise.resolve();
    if (this.loading) return this.loading;
    const version = this.requestsVersion;
    this.loading = dartFutureWait([adminProductionMapCompletionRequests(this.session), this.catalogLoaded ? Promise.resolve(this.state.catalog) : adminApparatus(this.session, { limit: 10000 })] as const).then(([requests, catalog]) => {
      if (!this.active()) return; this.catalogLoaded = true;
      this.update({ ...(version === this.requestsVersion ? { requests } : {}), catalog, loading: false, error: null });
    }).catch(error => { if (version === this.requestsVersion) this.update({ loading: false, error }); }).finally(() => { this.loading = null; });
    return this.loading;
  };
  setForeground(value: boolean) { this.foreground = value; this.stopLive(); if (value) this.connect(); }
  private stopLive() { this.liveGeneration++; this.stopFeed?.(); this.stopFeed = null; if (this.retry) clearTimeout(this.retry); if (this.first) clearTimeout(this.first); this.retry = this.first = null; }
  private connect() {
    this.stopLive(); if (!this.active() || !this.foreground) return;
    const generation = this.liveGeneration; let ended = false;
    const finish = (error?: unknown) => {
      if (ended || generation !== this.liveGeneration || !this.active() || !this.foreground) return; ended = true;
      this.stopFeed?.(); this.stopFeed = null; if (this.first) clearTimeout(this.first); this.first = null;
      const parts = error as { statusCode?: number; code?: string } | undefined;
      if (parts && ([401, 403].includes(parts.statusCode ?? 0) || ['forbidden', 'unauthorized', 'permission_denied'].includes(parts.code ?? ''))) { this.update({ error, loading: false }); return; }
      const delay = Math.round(Math.min(30000, 1000 * 2 ** Math.min(this.retryAttempt++, 5)) * (.5 + Math.random() * .5));
      this.retry = setTimeout(() => { this.retry = null; if (this.active() && generation === this.liveGeneration && this.foreground) { void this.load(); this.connect(); } }, delay);
    };
    this.first = setTimeout(() => finish(new Error('Notification stream')), 10000);
    try {
      const stop = adminProductionMapNotificationEvents(this.session).subscribe(requests => {
        if (!this.active() || generation !== this.liveGeneration || ended) return;
        if (this.first) clearTimeout(this.first); this.first = null; this.retryAttempt = 0; this.requestsVersion++;
        this.update({ requests, loading: false, error: null });
      }, finish, () => finish());
      if (ended) stop(); else this.stopFeed = stop;
    } catch (error) { finish(error); }
  }
  toggle = (request: Request) => { if (this.active() && this.interactive()) { const id = String(request.event_id).trim(); this.update({ expanded: this.state.expanded === id ? null : id }); } };
  decide = async (request: Request, decision: 'approve' | 'reject') => {
    const id = String(request.event_id).trim(); if (!id || !this.active() || !this.interactive() || this.state.deciding.has(id)) return;
    this.update({ deciding: new Set([...this.state.deciding, id]) });
    try {
      const result = await adminProductionMapCompletionRequestDecision(this.session, id, decision, () => { if (!this.active()) throw new Error('Original notification route expired'); });
      if (!this.active()) return; this.requestsVersion++;
      this.update({ requests: this.state.requests.filter(item => String(item.event_id).trim() !== id), expanded: null });
      this.notice(result.message, 'success'); void this.load();
    } catch { if (this.active()) this.notice(adminText('notification.completion_failed', this.locale()), 'error'); }
    finally { this.update({ deciding: new Set([...this.state.deciding].filter(item => item !== id)) }); }
  };
}
const metricKeys: Record<string, string> = { produced_qty: 'worker.qr.passport.produced_quantity', gross_qty: 'worker.daily.field.weight', return_ink_kg: 'worker.qr.passport.returned_ink', lamination_print_leftover_rolls: 'worker.daily.field.print_leftover', lamination_film_leftover_rolls: 'worker.daily.field.film_leftover', rezka_bosma_waste: 'worker.daily.field.print_waste', rezka_lamination_waste: 'worker.daily.field.lamination_waste', rezka_edge_waste: 'worker.daily.field.edge_waste', total_waste: 'worker.daily.field.total_waste', finished_goods_kg: 'worker.qr.passport.finished_weight', finished_goods_meter: 'worker.qr.passport.finished_length' };
export function brigaderNotificationRow(request: Request, catalog: AdminApparatus[], locale: string) {
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), text = (key: string) => String(request[key] ?? '').trim();
  const apparatus = catalog.find(item => item.id === text('apparatus'))?.name.trim() || text('apparatus');
  const worker = text('worker_display_name') || text('worker_ref') || text('worker_role') || a('notification.worker_fallback');
  const zeroCodes = request.zero_metric_codes as string[], decision = request.decision_required === true, code = text('order_number') || text('order_id') || a('notification.order_fallback');
  const title = a(decision ? zeroCodes.length ? 'notification.title_zero_metrics' : 'notification.title_zero_state' : 'notification.title_remainder', { code });
  const subtitle = a(decision ? 'notification.subtitle_attempt' : 'notification.subtitle_remainder', { apparatus, worker });
  const lines = [['order_title', 'item'], ['product_code', 'code']].filter(([key]) => text(key)).map(([key, label]) => a(`notification.${label}_line`, { value: text(key) }));
  if (apparatus) lines.push(a('notification.apparatus_line', { value: apparatus })); lines.push(a('notification.worker_line', { value: worker }));
  const time = dailyWorkDate(Number(request.created_at_unix)); if (time) lines.push(a('notification.time_line', { value: time }));
  return { id: text('event_id'), title, subtitle, lines, description: text('description'), decision, zero: zeroCodes.map(code => metricKeys[code.trim()] ? productionText(metricKeys[code.trim()], locale) : code.trim()).filter(Boolean).join(', ') };
}

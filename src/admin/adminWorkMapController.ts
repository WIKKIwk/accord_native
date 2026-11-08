import { adminWorkMapAuditPages, type AdminWorkMapAuditReport } from './adminWorkMapAuditModel';
import { adminWorkMapClosedPages, type AdminWorkMapClosedOrder } from './adminWorkMapClosedModel';
import { dartTrim } from './dartJsonString';

export type AdminWorkMapModule = 'sequence' | 'orders' | 'move' | 'closed' | 'audit';
export type AdminWorkMapRequest = { view: AdminWorkMapModule; apparatus?: string; target?: string };
export type AdminWorkMapRow = { kind: 'pending' | 'order'; id: string; code: string; title: string; customer: string; imageId: string;
  displayState: string; kg: number | null; position?: number; opened?: { secondary: string; apparatusCount: number } };
export type AdminWorkMapPage = { projection: string; version: string; epoch: string; scope: string; revision: number | null;
  total?: number; sequence_rows?: Record<string, any>; sequence_positions?: Record<string, number>;
  offset: number; length: number; next_cursor: string | null; order_ids: string[]; pending_ids: string[];
  order_rows: Record<string, any>; pending_rows: Record<string, any>; pending_orders: any[]; closed_orders: AdminWorkMapClosedOrder[];
  workflow_audit: AdminWorkMapAuditReport | null; snapshot: { maps: any[]; revision?: number | null; order_customers?: Record<string, string> } | null };
export type AdminWorkMapDetailTicket = { generation: number; id: string; kind: 'pending' | 'order'; epoch: string; revision: number | null;
  apparatus?: string; ordersSummary?: true };
export type AdminWorkMapState = { query: string; rows: readonly AdminWorkMapRow[]; loading: boolean; loaded: boolean; error: string | null; hasMore: boolean; total: number; audit: AdminWorkMapAuditReport | null; closed: readonly AdminWorkMapClosedOrder[] };
type Dependencies = { isCurrent: () => boolean; request?: AdminWorkMapRequest | null;
  read: (request: AdminWorkMapRequest & { search: string; cursor?: string | null }) => Promise<AdminWorkMapPage | null> };
const readError = 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.';
const emptyState = (): AdminWorkMapState => ({ query: '', rows: [], loading: false, loaded: false, error: null, hasMore: false, total: 0, audit: null, closed: [] });
const text = (value: unknown): string => typeof value === 'string' ? value : '';
function codeOf(value: { code?: unknown; order_number?: unknown; id?: unknown }) {
  const code = dartTrim(text(value.code)), number = dartTrim(text(value.order_number)), id = dartTrim(text(value.id));
  return code || number || (id.startsWith('zakaz-') ? dartTrim(id.slice(6)) : '');
}
export function adminWorkMapSearch(value: string): string { return Array.from(dartTrim(value)).slice(0, 120).join(''); }
/** Summary rows are display-only. Actions must hydrate their full detail. */
export function adminWorkMapRows(pages: readonly AdminWorkMapPage[], view: AdminWorkMapModule = 'orders'): AdminWorkMapRow[] {
  if (view === 'closed') { adminWorkMapClosedPages(pages); return []; }
  if (view === 'audit') { adminWorkMapAuditPages(pages); return []; }
  const pending: AdminWorkMapRow[] = [], orders: AdminWorkMapRow[] = [];
  // V2 collects snapshot customers in revision order. Only the current window's
  // guarded snapshots are available here; other retained module windows remain open parity work.
  const customers = new Map<string, string>();
  if (view === 'orders') for (const snapshot of pages.flatMap(page => page.snapshot ? [page.snapshot] : [])
    .sort((a, b) => (a.revision ?? 0) - (b.revision ?? 0))) {
    for (const [id, name] of Object.entries(snapshot.order_customers ?? {})) customers.set(id, name);
  }
  for (const page of pages) {
    if (page.closed_orders.length || page.workflow_audit) throw new Error(readError);
    if (page.projection === 'sequence_list_v1') {
      if (view !== 'sequence' || page.pending_ids.length || page.pending_orders.length) throw new Error(readError);
      for (const id of page.order_ids) {
        const row = page.sequence_rows?.[id], position = page.sequence_positions?.[id];
        if (!row || !Number.isSafeInteger(position) || position! < 1) throw new Error(readError);
        orders.push({ kind: 'order', id, code: codeOf(row), title: text(row.title), customer: text(row.customer_name),
          imageId: text(row.image_id), displayState: text(row.display_state), kg: null, position });
      }
    } else if (page.projection === 'orders_list_v1') {
      if (view !== 'orders') throw new Error(readError);
      for (const id of page.pending_ids) {
        const row = page.pending_rows[id];
        pending.push({ kind: 'pending', id, code: text(row.code), title: text(row.title), customer: text(row.customer_name),
          imageId: text(row.image_id), displayState: 'pending', kg: typeof row.kg === 'number' ? row.kg : null });
      }
      for (const id of page.order_ids) {
        const row = page.order_rows[id];
        orders.push({ kind: 'order', id, code: codeOf(row), title: text(row.title), customer: text(row.customer_name),
          imageId: text(row.image_id), displayState: text(row.display_state), kg: null,
          opened: { secondary: dartTrim(text(row.customer_name)), apparatusCount: 0 } });
      }
    } else if (page.projection === '') {
      if ((view === 'sequence' || view === 'move') && page.pending_orders.length) throw new Error(readError);
      for (const row of page.pending_orders) {
        const item = row.template;
        pending.push({ kind: 'pending', id: text(row.id), code: text(item.order_number), title: text(item.product), customer: text(item.customer),
          imageId: text(item.image_id), displayState: 'pending', kg: typeof item.kg === 'number' ? item.kg : null });
      }
      for (const id of page.order_ids) {
        const saved = page.snapshot?.maps.find(item => item.map.id === id), map = saved?.map;
        if (!map) throw new Error(readError);
        const product = view === 'move' || view === 'orders' ? text(map.nodes?.find((node: any) => node.kind === 'end' && dartTrim(text(node.title)) && dartTrim(text(node.title)) !== dartTrim(text(map.title)))?.title) : '';
        const customer = view === 'orders' ? dartTrim(customers.get(dartTrim(text(map.id))) ?? '') || dartTrim(text(map.customer_name)) : text(map.customer_name);
        orders.push({ kind: 'order', id, code: codeOf(map), title: view === 'move' || view === 'orders' ? dartTrim(text(map.title)) || dartTrim(product) : text(map.title),
          customer: view === 'move' ? dartTrim(text(map.customer_name)) || dartTrim(text(map.product_code)) || dartTrim(product) : customer,
          imageId: text(map.image_id), displayState: '', kg: null,
          ...(view === 'orders' ? { opened: { secondary: customer || dartTrim(text(map.product_code)) || dartTrim(product),
            apparatusCount: Array.isArray(map.nodes) ? map.nodes.filter((node: any) => node.kind === 'apparatus').length : 0 } } : {}),
          ...(view === 'sequence' ? { position: page.sequence_positions?.[id] ?? orders.length + 1 } : view === 'move' ? { position: orders.length + 1 } : {}) });
      }
    } else throw new Error(readError);
  }
  const all = [...pending, ...orders];
  if (new Set(all.map(row => row.id)).size !== all.length) throw new Error(readError);
  return all;
}

/** Current account owns a window; old requests cannot publish after search, reload or invalidation. */
export class AdminWorkMapController {
  private state = emptyState();
  private pages: AdminWorkMapPage[] = [];
  private listeners = new Set<() => void>();
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private started = false;
  private request: AdminWorkMapRequest | null;
  constructor(private readonly deps: Dependencies) { this.request = deps.request === undefined ? { view: 'orders' } : deps.request; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkMapState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private current(ticket: number) { return !this.disposed && ticket === this.generation && this.deps.isCurrent(); }
  detailTicket(row: AdminWorkMapRow): AdminWorkMapDetailTicket | null {
    if (this.request?.view === 'move' || !this.deps.isCurrent() || !this.state.rows.some(item => item.id === row.id && item.kind === row.kind)) return null;
    const first = this.pages[0];
    const source = this.pages.find(page => row.kind === 'order' && page.order_ids.includes(row.id));
    return first ? { generation: this.generation, id: row.id, kind: row.kind, epoch: first.epoch, revision: first.revision,
      ...(this.request?.view === 'orders' && source?.projection === 'orders_list_v1' ? { ordersSummary: true as const } : {}),
      ...(this.request?.view === 'sequence' ? { apparatus: this.request.apparatus } : {}) } : null;
  }
  detailIsCurrent(ticket: AdminWorkMapDetailTicket): boolean {
    return this.current(ticket.generation) && this.state.rows.some(item => item.id === ticket.id && item.kind === ticket.kind);
  }
  configure(request: AdminWorkMapRequest | null) {
    if (this.disposed || !this.deps.isCurrent()) return;
    if (this.request?.view === request?.view && this.request?.apparatus === request?.apparatus && this.request?.target === request?.target) return;
    this.request = request;
    this.generation++; this.pages = [];
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.publish({ ...emptyState(), query: this.state.query, loading: request != null });
    if (this.started && request) void this.reload();
  }
  start() { if (!this.started && !this.disposed) { this.started = true; void this.reload(); } }
  invalidate() { if (this.disposed) return; this.generation++; if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.pages = []; this.publish({ ...emptyState() }); }
  dispose() { this.invalidate(); this.disposed = true; this.listeners.clear(); }
  setQuery(value: string) {
    if (this.disposed || !this.deps.isCurrent()) return;
    const next = adminWorkMapSearch(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (next === this.state.query && this.state.loaded) return;
    this.generation++; this.pages = [];
    this.publish({ query: next, rows: [], loading: this.request != null, loaded: false, error: null, hasMore: false, total: 0, audit: null, closed: [] });
    this.timer = setTimeout(() => { this.timer = null; void this.reload(); }, 350);
  }
  async reload() { if (this.timer) clearTimeout(this.timer); this.timer = null; return this.load(false); }
  async next() { if (!this.state.hasMore || this.state.loading || this.state.error != null) return; return this.load(true); }
  private async load(append: boolean) {
    if (this.disposed || !this.deps.isCurrent() || !this.request) return;
    const request = this.request, ticket = ++this.generation, previous = append ? [...this.pages] : [], cursor = append ? previous.at(-1)?.next_cursor : null;
    if (append && !cursor) return;
    this.publish({ loading: true, error: null });
    try {
      const page = await this.deps.read({ ...request, search: this.state.query, ...(cursor ? { cursor } : {}) });
      if (!this.current(ticket)) return;
      if (!page) throw new Error(readError);
      const first = previous[0], expected = previous.reduce((sum, item) => sum + item.length, 0);
      if (page.offset !== expected || (first && (page.version !== first.version || page.epoch !== first.epoch || page.scope !== first.scope))) throw new Error(readError);
      const pages = [...previous, page], audit = request.view === 'audit' ? adminWorkMapAuditPages(pages) : null,
        closed = request.view === 'closed' ? adminWorkMapClosedPages(pages) : [],
        rows = request.view === 'audit' || request.view === 'closed' ? [] : adminWorkMapRows(pages, request.view);
      this.pages = pages;
      this.publish({ rows, loading: false, loaded: true, error: null, hasMore: page.next_cursor != null, total: page.total ?? rows.length, audit, closed });
    } catch (error) {
      if (!this.current(ticket)) return;
      this.publish({ loading: false, loaded: !append && !previous.length ? false : this.state.loaded,
        error: error instanceof Error ? error.message : readError });
    }
  }
}

import { dartTrim } from './dartJsonString';

export type AdminWorkMapRow = { kind: 'pending' | 'order'; id: string; code: string; title: string; customer: string; imageId: string;
  displayState: string; kg: number | null };
export type AdminWorkMapPage = { projection: string; version: string; epoch: string; scope: string; revision: number | null;
  offset: number; length: number; next_cursor: string | null; order_ids: string[]; pending_ids: string[];
  order_rows: Record<string, any>; pending_rows: Record<string, any>; pending_orders: any[]; closed_orders: any[];
  workflow_audit: any; snapshot: { maps: any[] } | null };
export type AdminWorkMapDetailTicket = { generation: number; id: string; kind: 'pending' | 'order'; epoch: string; revision: number | null };
export type AdminWorkMapState = { query: string; rows: readonly AdminWorkMapRow[]; loading: boolean; loaded: boolean; error: string | null; hasMore: boolean };
type Dependencies = { isCurrent: () => boolean; read: (request: { view: 'orders'; search: string; cursor?: string | null }) => Promise<AdminWorkMapPage | null> };
const readError = 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.';
const emptyState = (): AdminWorkMapState => ({ query: '', rows: [], loading: false, loaded: false, error: null, hasMore: false });
const text = (value: unknown): string => typeof value === 'string' ? value : '';
function codeOf(value: { code?: unknown; order_number?: unknown; id?: unknown }) {
  const code = dartTrim(text(value.code)), number = dartTrim(text(value.order_number)), id = dartTrim(text(value.id));
  return code || number || (id.startsWith('zakaz-') ? dartTrim(id.slice(6)) : '');
}
export function adminWorkMapSearch(value: string): string { return Array.from(dartTrim(value)).slice(0, 120).join(''); }
/** Summary rows are display-only. Actions must hydrate their full detail. */
export function adminWorkMapRows(pages: readonly AdminWorkMapPage[]): AdminWorkMapRow[] {
  const pending: AdminWorkMapRow[] = [], orders: AdminWorkMapRow[] = [];
  for (const page of pages) {
    if (page.closed_orders.length || page.workflow_audit) throw new Error(readError);
    if (page.projection === 'orders_list_v1') {
      for (const id of page.pending_ids) {
        const row = page.pending_rows[id];
        pending.push({ kind: 'pending', id, code: text(row.code), title: text(row.title), customer: text(row.customer_name),
          imageId: text(row.image_id), displayState: 'pending', kg: typeof row.kg === 'number' ? row.kg : null });
      }
      for (const id of page.order_ids) {
        const row = page.order_rows[id];
        orders.push({ kind: 'order', id, code: codeOf(row), title: text(row.title), customer: text(row.customer_name),
          imageId: text(row.image_id), displayState: text(row.display_state), kg: null });
      }
    } else if (page.projection === '') {
      for (const row of page.pending_orders) {
        const item = row.template;
        pending.push({ kind: 'pending', id: text(row.id), code: text(item.order_number), title: text(item.product), customer: text(item.customer),
          imageId: text(item.image_id), displayState: 'pending', kg: typeof item.kg === 'number' ? item.kg : null });
      }
      for (const id of page.order_ids) {
        const saved = page.snapshot?.maps.find(item => item.map.id === id), map = saved?.map;
        if (!map) throw new Error(readError);
        orders.push({ kind: 'order', id, code: codeOf(map), title: text(map.title), customer: text(map.customer_name),
          imageId: text(map.image_id), displayState: '', kg: null });
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
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkMapState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private current(ticket: number) { return !this.disposed && ticket === this.generation && this.deps.isCurrent(); }
  detailTicket(row: AdminWorkMapRow): AdminWorkMapDetailTicket | null {
    if (!this.deps.isCurrent() || !this.state.rows.some(item => item.id === row.id && item.kind === row.kind)) return null;
    const first = this.pages[0];
    return first ? { generation: this.generation, id: row.id, kind: row.kind, epoch: first.epoch, revision: first.revision } : null;
  }
  detailIsCurrent(ticket: AdminWorkMapDetailTicket): boolean {
    return this.current(ticket.generation) && this.state.rows.some(item => item.id === ticket.id && item.kind === ticket.kind);
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
    this.publish({ query: next, rows: [], loading: true, loaded: false, error: null, hasMore: false });
    this.timer = setTimeout(() => { this.timer = null; void this.reload(); }, 350);
  }
  async reload() { if (this.timer) clearTimeout(this.timer); this.timer = null; return this.load(false); }
  async next() { if (!this.state.hasMore || this.state.loading) return; return this.load(true); }
  private async load(append: boolean) {
    if (this.disposed || !this.deps.isCurrent()) return;
    const ticket = ++this.generation, previous = append ? [...this.pages] : [], cursor = append ? previous.at(-1)?.next_cursor : null;
    if (append && !cursor) return;
    this.publish({ loading: true, error: null });
    try {
      const page = await this.deps.read({ view: 'orders', search: this.state.query, ...(cursor ? { cursor } : {}) });
      if (!this.current(ticket)) return;
      if (!page) throw new Error(readError);
      const first = previous[0], expected = previous.reduce((sum, item) => sum + item.length, 0);
      if (page.offset !== expected || (first && (page.version !== first.version || page.epoch !== first.epoch || page.scope !== first.scope))) throw new Error(readError);
      const pages = [...previous, page], rows = adminWorkMapRows(pages);
      this.pages = pages;
      this.publish({ rows, loading: false, loaded: true, error: null, hasMore: page.next_cursor != null });
    } catch (error) {
      if (!this.current(ticket)) return;
      this.publish({ loading: false, loaded: !append && !previous.length ? false : this.state.loaded,
        error: error instanceof Error ? error.message : readError });
    }
  }
}

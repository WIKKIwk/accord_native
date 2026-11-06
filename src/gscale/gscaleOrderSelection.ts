import { searchMatches } from '../shared/searchNormalizer';
import type { GScaleModeArgs } from './gscaleRouteArgs';

export type GScaleOrder = NonNullable<GScaleModeArgs['order']>;
export type GScaleOrderSelectionState = { orders: GScaleOrder[]; selectedId: string | null; loading: boolean;
  error: unknown | null; disabled: boolean; publicationPending: boolean };

/** State from PreparationKirimOrderSection. */
export class GScaleOrderSelectionStore {
  private state: GScaleOrderSelectionState;
  private listeners = new Set<() => void>();
  private alive = true;
  constructor(initial: GScaleOrder | null, disabled: boolean, private readonly loadOrders: () => Promise<GScaleOrder[]>,
    private readonly onOrderChanged: (order: GScaleOrder | null) => void) {
    this.state = { orders: [], selectedId: initial?.id ?? null, loading: true, error: null, disabled, publicationPending: false };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(patch: Partial<GScaleOrderSelectionState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  get selectedOrder(): GScaleOrder | null { return this.state.orders.find(value => value.id === this.state.selectedId) ?? null; }
  get selectedLabel(): string { return this.selectedOrder ? gscaleOrderLabel(this.selectedOrder) : this.state.selectedId ?? ''; }
  get widthLabel(): string | null {
    const width = this.selectedOrder?.width_mm;
    return width != null && Number.isFinite(width) && width > 0 ? `Order eni: ${width} mm` : null;
  }
  setDisabled(disabled: boolean): void {
    const publish = this.state.disabled && !disabled && this.state.publicationPending;
    this.update({ disabled });
    if (publish) queueMicrotask(() => this.publishLoadedOrder());
  }
  private publishLoadedOrder(): void {
    if (!this.alive || this.state.disabled || this.state.loading || this.state.error != null || !this.state.publicationPending) return;
    const selectedId = this.state.selectedId && this.state.orders.some(value => value.id === this.state.selectedId) ? this.state.selectedId : null;
    this.update({ selectedId, publicationPending: false });
    this.onOrderChanged(this.selectedOrder);
  }
  /** @v2 _loadOrders */
  async load(): Promise<void> {
    this.update({ loading: true, error: null });
    try {
      const orders = await this.loadOrders();
      if (!this.alive) return;
      this.update({ orders: orders.filter(order => !order.saved), loading: false, publicationPending: true });
      this.publishLoadedOrder();
    } catch (error) { this.update({ loading: false, error }); }
  }
  select(order: GScaleOrder): void {
    if (!this.alive || this.state.disabled || !this.state.orders.some(value => value.id === order.id)) return;
    this.update({ selectedId: order.id });
    this.onOrderChanged(order);
  }
  page(query: string, offset: number, limit: number): GScaleOrder[] {
    const normalized = query.trim().toLowerCase();
    return this.state.orders.filter(order => !normalized || searchMatches(normalized,
      [order.id, order.code, order.title, gscaleOrderLabel(order)])).slice(offset, offset + limit);
  }
  dispose(): void { this.alive = false; this.listeners.clear(); }
}

/** @v2 _orderLabel */
export function gscaleOrderLabel(order: GScaleOrder): string {
  const code = order.code.trim() ? order.code : order.id, title = order.title.trim();
  return title ? `${code} — ${title}` : code;
}

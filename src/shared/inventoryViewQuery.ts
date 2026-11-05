import { inventoryAssetFromJson, inventoryLocationFromJson, inventoryTransferFromJson } from '../inventoryModels';

type Kind = 'assets' | 'transfers' | 'locations';
type Row = Record<string, unknown>;
export type InventoryAssetsQuery = { warehouseId?: string; query?: string; assetKind?: string | null;
  currentUserStatesOnly?: boolean; includeOrderAssignment?: boolean; limit?: number; offset?: number };
export type InventoryTransfersQuery = { direction?: string; status?: string | null; limit?: number; offset?: number };

/** @v2 InventoryViewQuery */
export class InventoryViewQuery {
  private constructor(readonly kind: Kind, readonly parameters: Readonly<Record<string, string>>) {}
  static locations(): InventoryViewQuery { return new InventoryViewQuery('locations', {}); }
  static assets(input: InventoryAssetsQuery = {}): InventoryViewQuery {
    return new InventoryViewQuery('assets', {
      ...(input.warehouseId?.trim() ? { warehouse_id: input.warehouseId.trim() } : {}),
      ...(input.query?.trim() ? { query: input.query.trim() } : {}),
      ...(input.assetKind != null ? { asset_kind: input.assetKind } : {}),
      ...(input.currentUserStatesOnly ? { current_user_states_only: 'true' } : {}),
      ...(input.includeOrderAssignment !== false ? { include_order_assignment: 'true' } : {}),
      limit: String(input.limit ?? 100), ...(input.offset && input.offset > 0 ? { offset: String(input.offset) } : {}),
    });
  }
  static transfers(input: InventoryTransfersQuery = {}): InventoryViewQuery {
    return new InventoryViewQuery('transfers', { direction: input.direction ?? 'all',
      ...(input.status != null ? { status: input.status } : {}), limit: String(input.limit ?? 100),
      ...(input.offset && input.offset > 0 ? { offset: String(input.offset) } : {}) });
  }
  get key(): string { return JSON.stringify([this.kind, this.parameters]); }
  get liveBucket(): string {
    if (this.kind === 'assets') return `assets:${this.parameters.current_user_states_only === 'true'}`;
    if (this.kind === 'transfers') return `transfers:${this.parameters.direction}`;
    return this.kind;
  }
  decode(row: unknown): Row {
    if (this.kind === 'assets') return inventoryAssetFromJson(row);
    if (this.kind === 'transfers') return inventoryTransferFromJson(row);
    return inventoryLocationFromJson(row);
  }
  rowKey(row: Row): string {
    return this.kind === 'assets' ? `${String(row.kind)}:${String(row.asset_ref)}` : String(row.id);
  }
  subscription(version?: string | null): { id: string; kind: Kind; query: Record<string, string | number | boolean>; version?: string } {
    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(this.parameters)) {
      query[key] = ['limit', 'offset'].includes(key) ? Number(value)
        : ['current_user_states_only', 'include_order_assignment'].includes(key) ? value === 'true' : value;
    }
    return { id: 'window', kind: this.kind, query, ...(version != null ? { version } : {}) };
  }
}

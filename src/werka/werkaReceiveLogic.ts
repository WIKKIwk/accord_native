import type { WerkaPaddonPreview, WerkaWipPreview } from './werkaPaddonApi';

type ReceiveState = { busy: boolean; mustReload: boolean; receipt: Record<string, unknown> | null; warehouse: string | null };

/** Warehouse selection used by the V2 Paddon and WIP preview refresh paths. */
export function werkaWarehouseAfterPreview(warehouses: readonly string[], previous: string | null): string | null {
  if (previous !== null && warehouses.includes(previous)) return previous;
  return warehouses.length === 1 ? warehouses[0] : null;
}

/** Pure form of the guards in WerkaPaddonReceiveScreen._accept. */
export function canReceiveWerkaPaddon(preview: WerkaPaddonPreview | null, state: ReceiveState): boolean {
  return !state.busy && !state.mustReload && preview !== null && state.warehouse !== null && state.receipt === null &&
    preview.canReceive && preview.snapshotToken !== '';
}

/** @v2 _canReceive */
export function canReceiveWerkaWip(preview: WerkaWipPreview, state: ReceiveState): boolean {
  return !state.busy && !state.mustReload && state.receipt === null && preview.canReceive && preview.snapshotToken !== '' &&
    preview.batch.batch_id !== '' && preview.batch.qr_payload !== '' && state.warehouse !== null;
}

/** WIP reload must retain the same server-confirmed batch identity. */
export function sameWerkaWipIdentity(previous: WerkaWipPreview, fresh: WerkaWipPreview | null): boolean {
  return fresh !== null && fresh.batch.batch_id === previous.batch.batch_id;
}

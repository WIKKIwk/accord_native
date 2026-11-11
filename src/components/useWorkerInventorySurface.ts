import { useRef, useState } from 'react';
import type { Session } from '../auth';
import { movementAssigned, movementAvailable, movementAssetKey, movementCanSelect, movementQuantity, movementStatus, movementTimestamp,
  type MovementAsset, type MovementLocation, type MovementTransfer } from '../shared/inventoryMovementModel';
import type { WorkerAlertData } from './workerDialogTypes';
import { useWorkerInventory } from './useWorkerInventory';
import { useWorkerOrderText } from './useWorkerOrderText';

export type InventorySheet = { id: number } & ({ kind: 'asset' | 'qr'; asset: MovementAsset } | { kind: 'transfer'; transfer: MovementTransfer } |
  { kind: 'location'; title: string; empty: string; locations: readonly MovementLocation[]; choose(location: MovementLocation): void });
type SheetContent = InventorySheet extends infer S ? S extends InventorySheet ? Omit<S, 'id'> : never : never;

export function useWorkerInventorySurface(session: Session) {
  const inventory = useWorkerInventory(session), { owner, state } = inventory, { t } = useWorkerOrderText();
  const [sheet, setSheet] = useState<InventorySheet | null>(null), [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const sequence = useRef(0), currentSheet = useRef<number | null>(null), continuation = useRef<(() => void) | null>(null);
  const open = (content: SheetContent) => {
    if (!owner.current() || currentSheet.current !== null) return;
    const id = ++sequence.current; currentSheet.current = id; setSheet({ ...content, id } as InventorySheet);
  };
  const dismiss = (id: number) => {
    if (currentSheet.current !== id) return;
    currentSheet.current = null; setSheet(null);
    const next = continuation.current; continuation.current = null;
    if (owner.current()) next?.();
  };
  const afterClose = (id: number, action: () => void) => { if (owner.current() && currentSheet.current === id && !continuation.current) continuation.current = action; };
  const confirm = (title: string, message: string, confirmLabel: string, action: () => void) => {
    if (owner.current()) setAlert({ title: t(title), message: t(message), confirmLabel: t(confirmLabel), cancelLabel: t('Bekor qilish'), onConfirm: () => { if (owner.current()) action(); } });
  };
  const chooseRelocation = (asset: MovementAsset) => open({ kind: 'location', title: 'Fizik joylashuv', empty: 'Faol state topilmadi', locations: owner.relocateDestinations(asset), choose: location => { void owner.relocate(asset, location); } });
  const chooseTransfer = (asset: MovementAsset) => open({ kind: 'location', title: 'Qabul qiluvchi ombor', empty: 'Boshqa ombor topilmadi', locations: owner.transferDestinations(asset), choose: location => {
    const assigned = movementAssigned(session), internal = assigned.has(asset.custody_warehouse.trim().toLowerCase()) && assigned.has(location.name.trim().toLowerCase());
    const explanation = internal ? 'Ikkala ombor ham sizga biriktirilgan. Mahsulot darhol qabul qiluvchi omborga ko‘chiriladi.' : 'Qabul qiluvchi tasdiqlamaguncha mahsulot manba omborda band holatda qoladi.';
    confirm(internal ? 'Ichki ko‘chirish' : 'Transfer so‘rovi', `${asset.item_name} (${movementQuantity(asset.qty)} ${asset.uom})\n${asset.custody_warehouse} → ${location.name}\n\n${explanation}`,
      internal ? 'Ko‘chirish' : 'So‘rov yuborish', () => { void owner.transfer(asset, location); });
  } });
  const relocateSelected = () => {
    const assets = owner.selectedAssets;
    if (!assets.length) { owner.clearSelection(); return; }
    open({ kind: 'location', title: 'Qaysi State’ga ko‘chirasiz?', empty: 'Faol State topilmadi', locations: owner.states, choose: location => {
      confirm('State’ga ko‘chirish', `${assets.length} ta mahsulot ${location.name} State’ga ko‘chirilsinmi?`, 'Ko‘chirish', () => { void owner.relocateSelected(location, assets); });
    } });
  };
  const assets = state.scanning ? state.qrAssets : state.assets;
  const rows = assets.map(asset => ({ asset, key: movementAssetKey(asset), title: asset.item_name.trim() ? asset.item_name : asset.item_code,
    supporting: [asset.identifier.trim(), `${movementQuantity(asset.qty)} ${asset.uom}`, t(movementStatus(asset.status))].filter(Boolean).join(' • '),
    status: movementStatus(asset.status), selected: state.selected.has(movementAssetKey(asset)),
    selectable: movementCanSelect(session, asset, state.warehouse, state.scanning) && ![...state.busy].some(key => key.includes(`${asset.kind}:${asset.asset_ref}`)),
    open: () => { if (state.selected.size) owner.toggleSelection(asset); else open({ kind: 'asset', asset }); },
    hold: () => owner.toggleSelection(asset),
  }));
  const transfers = (state.tab === 'incoming' ? state.incoming : state.outgoing).map(transfer => ({ key: String(transfer.id),
    title: `${transfer.source_warehouse} → ${transfer.destination_warehouse}`, status: movementStatus(transfer.status),
    supporting: transfer.lines.length ? `${transfer.lines[0].item_name || transfer.lines[0].item_code}${transfer.lines.length > 1 ? ` +${transfer.lines.length - 1} ta` : ''} • ${movementQuantity(transfer.lines[0].qty)} ${transfer.lines[0].uom} • ${movementTimestamp(transfer)}` : movementTimestamp(transfer),
    open: () => open({ kind: 'transfer', transfer }),
  }));
  const canRelocate = sheet?.kind === 'asset' && movementAvailable(sheet.asset) && ![...state.busy].some(key => key.includes(`${sheet.asset.kind}:${sheet.asset.asset_ref}`));
  const canTransfer = canRelocate && sheet?.kind === 'asset' && sheet.asset.physical_location.kind === 'warehouse';
  const loading = state.loading || (!state.scanning && (state.tab === 'assets' ? state.assetsLoading : state.transferLoading));
  const empty = state.scanning ? 'QR skaner qilingan mahsulotlar shu yerda chiqadi' : state.tab === 'assets'
    ? owner.warehouses.length ? 'Omborda harakatlantiriladigan mahsulot yo‘q' : 'Sizga biriktirilgan ombor topilmadi'
    : state.tab === 'incoming' ? 'Kiruvchi transfer yo‘q' : 'Chiquvchi transfer yo‘q';
  return { ...inventory, sheet, dismiss, afterClose, openQr: (asset: MovementAsset) => open({ kind: 'qr', asset }), chooseRelocation, chooseTransfer,
    relocateSelected, rows, transfers, canRelocate, canTransfer, loading, empty, alert, dismissAlert: () => setAlert(null), t };
}
export type WorkerInventorySurface = ReturnType<typeof useWorkerInventorySurface>;

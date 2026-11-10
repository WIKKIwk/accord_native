import type { Session } from './auth';
import type { AdminApparatus } from './apparatusApi';
import type { paddonSnapshotFromJson } from './paddonModels';
import { rezkaPaddonBobinaUnits } from './rezka/rezkaPaddonBobina';

export type WorkerPaddonSnapshot = ReturnType<typeof paddonSnapshotFromJson>;
export type WorkerPaddon = WorkerPaddonSnapshot['paddon'];
export type WorkerPaddonBatch = WorkerPaddonSnapshot['items'][number];
export type WorkerPaddonText = (key: string, values?: Record<string, unknown>) => string;
export const workerPaddonMovable = (batch: WorkerPaddonBatch) => !!batch.batch_id.trim() && batch.wip_status === 'waiting' &&
  !String(batch.payload_json.finished_goods_stock_id ?? '') && !String(batch.payload_json.received_warehouse ?? '');

/** @v2 _AparatchiPaddonTransferScreenState._editable */
export function workerPaddonEditable(snapshot: WorkerPaddonSnapshot | null, session: Session): boolean {
  return !!snapshot && snapshot.paddon.locked_at_unix == null && snapshot.can_manage_items &&
    (['admin', 'brigader'].includes(String(session.profile.role)) || snapshot.free_movement_enabled || snapshot.paddon.created_by_ref === session.profile.ref);
}
export function workerPaddonHasCapability(session: Session, keys: string[]) { return keys.some(key => session.capabilities.includes(key)); }
export const workerPaddonCanDelete = (session: Session) => workerPaddonHasCapability(session, ['admin.access', 'brigader.access', 'production.map.manage', 'apparatus.queue.manage']);
export const workerPaddonCanTransfer = (session: Session, options: AdminApparatus[], apparatus: string) => options.some(row => row.id === apparatus) &&
  workerPaddonHasCapability(session, ['admin.access', 'brigader.access', 'apparatus.queue.manage']);

/** V2 clears both selections whenever the bobina filter or editing mode changes. */
export function workerPaddonItems(snapshot: WorkerPaddonSnapshot, mode: 'add' | 'remove' | null, bobina: number | null) {
  return (mode === 'add' ? snapshot.available_items : snapshot.items).filter(row => bobina == null || rezkaPaddonBobinaUnits(row.bobina_kg) === bobina);
}
export class WorkerPaddonRetired extends Error {}
export class WorkerPaddonError extends Error { constructor(readonly code: string) { super(code); } }

/** Observable local state only; the injected owner guards every transport boundary. */
export class WorkerPaddonState<T> {
  private listeners = new Set<() => void>();
  protected stopped = false;
  protected revision = 0;
  constructor(protected state: T, private alive: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  current = () => !this.stopped && this.alive();
  capture = () => { const revision = this.revision; return () => this.current() && revision === this.revision; };
  protected check(current = this.current) { if (!current()) throw new WorkerPaddonRetired(); }
  protected update(change: Partial<T>) { if (this.current()) { this.state = { ...this.state, ...change }; this.listeners.forEach(fn => fn()); } }
  invalidate() { this.stopped = true; this.revision++; this.state = { ...this.state }; this.listeners.forEach(fn => fn()); }
}

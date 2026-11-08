import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { paddonSnapshotFromJson } from '../paddonModels';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';
import { progressBatchFromJson } from '../workerProgressBatch';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value);
function warehouses(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid warehouses');
  return value.filter((item): item is string => typeof item === 'string');
}
function apparatusNames(value: unknown): Record<string, string> {
  const row = object(value);
  return row ? Object.fromEntries(Object.entries(row).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
}

/** @v2 WerkaPaddonPreview */
export function werkaPaddonPreviewFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid paddon preview');
  return { snapshot: paddonSnapshotFromJson(row), warehouses: warehouses(row.warehouses), canReceive: row.can_receive === true,
    snapshotToken: text(row.snapshot_token), receipt: object(row.receipt), apparatusNames: apparatusNames(row.apparatus_names) };
}
export type WerkaPaddonPreview = ReturnType<typeof werkaPaddonPreviewFromJson>;

/** @v2 WerkaWipPreview */
export function werkaWipPreviewFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid WIP preview');
  return { batch: progressBatchFromJson(row.batch), warehouses: warehouses(row.warehouses), canReceive: row.can_receive === true,
    snapshotToken: text(row.snapshot_token), receipt: object(row.receipt), receiveBlockedReason: text(row.receive_blocked_reason),
    paddonCode: text(row.paddon_code), apparatusNames: apparatusNames(row.apparatus_names) };
}
export type WerkaWipPreview = ReturnType<typeof werkaWipPreviewFromJson>;

/** @v2 WerkaQrPreview */
export function werkaQrPreviewFromJson(code: string, value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid QR preview');
  if (row.kind === 'paddon') return { code, paddon: werkaPaddonPreviewFromJson(row), wip: null };
  if (row.kind === 'wip') return { code, paddon: null, wip: werkaWipPreviewFromJson(row) };
  throw new MobileApiException({ code: 'qr_preview_invalid', message: 'QR javobi noto‘g‘ri' });
}

async function payload(response: Response, fallback: string): Promise<Obj> {
  if (response.status !== 200) {
    let value: unknown;
    try { value = await response.json(); } catch { value = null; }
    // This shared mapper currently has documented gaps relative to the complete V2 mapper.
    throw productionMapResponseError(response.status, value, fallback);
  }
  const value = object(await response.json());
  if (!value) throw new TypeError('Invalid Werka response');
  return value;
}
function receipt(row: Obj): Obj {
  const value = object(row.receipt);
  if (!value) throw new TypeError('Invalid receipt');
  return value;
}

/** @v2 werkaPaddonPreview */
export async function werkaPaddonPreview(session: Session, code: string): Promise<WerkaPaddonPreview> {
  const query = new URLSearchParams({ code: code.trim() });
  const response = await authorizedFetch(session, `/v1/mobile/werka/paddons/preview?${query}`);
  return werkaPaddonPreviewFromJson(await payload(response, 'paddon_preview_failed'));
}

/** @v2 werkaReceivePaddon */
export async function werkaReceivePaddon(session: Session, preview: WerkaPaddonPreview, warehouse: string): Promise<Obj> {
  const response = await authorizedFetch(session, '/v1/mobile/werka/paddons/receive', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: preview.snapshot.paddon.code, warehouse,
      expected_batch_ids: preview.snapshot.items.map(item => item.batch_id), snapshot_token: preview.snapshotToken }) });
  return receipt(await payload(response, 'paddon_receive_failed'));
}

/** @v2 werkaQrPreview */
export async function werkaQrPreview(session: Session, rawCode: string) {
  const code = rawCode.trim(), query = new URLSearchParams({ qr_payload: code });
  const response = await authorizedFetch(session, `/v1/mobile/werka/qr/preview?${query}`);
  return werkaQrPreviewFromJson(code, await payload(response, 'qr_preview_failed'));
}

/** @v2 werkaReceiveWip */
export async function werkaReceiveWip(session: Session, preview: WerkaWipPreview, warehouse: string): Promise<Obj> {
  const response = await authorizedFetch(session, '/v1/mobile/werka/wip/receive', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress_batch_id: preview.batch.batch_id,
      qr_payload: preview.batch.qr_payload, warehouse, snapshot_token: preview.snapshotToken }) });
  return receipt(await payload(response, 'wip_receive_failed'));
}

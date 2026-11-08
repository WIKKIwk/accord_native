import Storage from 'expo-sqlite/kv-store';
import type { Session } from '../auth';
import { currentSession } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { RawSplitIssue, RawSplitResult, RawSplitRoll, RawSplitSnapshot } from './rawSplitModel';

type Json = Record<string, unknown>;
function object(value: unknown): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid object');
  return value as Json;
}
function currentScope(): string {
  const session = currentSession();
  const ref = session?.profile.ref;
  if (!session || session.profile.role !== 'homashyo_rezkachi' || typeof ref !== 'string' || !ref ||
    !session.capabilities.includes('raw_material.split')) throw new Error('Homashyo rezkachisi huquqi kerak');
  return `raw-material-split.pending.v1:${session.baseUrl}:${ref}`;
}
/** @v2 rawSplitScope */
export function rawSplitScope(): string { return currentScope(); }
function guard(scope: string): void { if (rawSplitScope() !== scope) throw new Error('Akkaunt o‘zgargan'); }
function parsePending(raw: string | null): Json | null { return raw === null ? null : object(JSON.parse(raw)); }

/** @v2 rawSplitPending */
export async function rawSplitPending(): Promise<Json | null> {
  const scope = rawSplitScope(), raw = await Storage.getItemAsync(scope); guard(scope); return parsePending(raw);
}
/** @v2 rawSplitIssuePending */
export async function rawSplitIssuePending(): Promise<Json | null> {
  const scope = rawSplitScope(), raw = await Storage.getItemAsync(`${scope}:issue`); guard(scope); return parsePending(raw);
}
async function responseObject(response: Response): Promise<Json> {
  let row: Json | null;
  try { row = object(await response.json()); } catch { row = null; }
  if (response.status !== 200 || row === null) {
    const error = row?.error;
    if (error != null && typeof error !== 'string') throw new TypeError('Invalid error message');
    throw new MobileApiException({ code: 'raw_split_request_failed', statusCode: response.status,
      message: error ?? 'Natija olinmadi. Qayta tekshiring.' });
  }
  return row;
}
async function read(session: Session, path: string, query?: URLSearchParams): Promise<Json> {
  const scope = rawSplitScope();
  const response = await authorizedFetch(session, `/v1/mobile/raw-material-split/${path}${query ? `?${query}` : ''}`,
    {}, () => guard(scope));
  guard(scope); return responseObject(response);
}
/** @v2 rawSplitSnapshot */
export async function rawSplitSnapshot(session: Session): Promise<RawSplitSnapshot> {
  return new RawSplitSnapshot(await read(session, 'snapshot'));
}
/** @v2 rawSplitSource */
export async function rawSplitSource(session: Session, barcode: string): Promise<RawSplitRoll> {
  const result = new RawSplitRoll(await read(session, 'source', new URLSearchParams({ barcode: barcode.trim() })));
  if (result.revision === null || !result.revision) throw new Error('Rulon versiyasi olinmadi');
  return result;
}
const definitiveErrors = new Set(['raw_split_invalid', 'raw_split_conflict', 'raw_split_scope']);
async function clearDefinitiveRejection(response: Response, key: string): Promise<void> {
  if (response.status < 400 || response.status >= 500) return;
  let code: unknown;
  try { code = object(await response.clone().json()).code; } catch { return; }
  if (typeof code === 'string' && definitiveErrors.has(code)) await Storage.removeItemAsync(key);
}
let saving = false, issueSaving = false;
/** @v2 rawSplitSave */
export async function rawSplitSave(session: Session, payload: Json): Promise<RawSplitResult> {
  if (saving) throw new Error('Saqlash davom etmoqda');
  saving = true;
  try {
    const scope = rawSplitScope(), raw = await Storage.getItemAsync(scope), pending = parsePending(raw) ?? { ...payload };
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi operatsiya natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(scope, serialized);
    if (await Storage.getItemAsync(scope) !== serialized) throw new Error('So‘rov kaliti saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/split',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope));
    await clearDefinitiveRejection(response, scope);
    const result = new RawSplitResult(await responseObject(response));
    if (result.issueId !== (pending.issue_id ?? null)) throw new Error('Muammo qaydi bilan saqlash tasdiqlanmadi');
    if (!await Storage.removeItemAsync(scope)) throw new Error('Operatsiya natijasini qayta tekshiring');
    guard(scope); return result;
  } finally { saving = false; }
}
/** @v2 rawSplitReportIssue */
export async function rawSplitReportIssue(session: Session, payload: Json): Promise<RawSplitIssue> {
  if (issueSaving) throw new Error('Muammo saqlanmoqda');
  issueSaving = true;
  try {
    const scope = rawSplitScope(), key = `${scope}:issue`, raw = await Storage.getItemAsync(key), pending = parsePending(raw) ?? payload;
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi muammo natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(key, serialized);
    if (await Storage.getItemAsync(key) !== serialized) throw new Error('Muammo so‘rovi saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/issues',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope));
    await clearDefinitiveRejection(response, key);
    const result = new RawSplitIssue(await responseObject(response));
    const command = object(pending.command), outputs = command.outputs;
    if (!Array.isArray(outputs) || typeof pending.note !== 'string' || result.requestId !== command.request_id ||
      result.source.barcode !== command.source_barcode || result.note !== pending.note.trim() || result.enteredWaste !== command.waste_kg ||
      result.outputs.length !== outputs.length || result.outputs.some((output, i) => Object.entries(output).some(([key, value]) =>
        object(outputs[i])[key] !== value))) throw new Error('Boshqa muammoning javobi olindi');
    if (!await Storage.removeItemAsync(key)) throw new Error('Muammo natijasini qayta tekshiring');
    guard(scope); return result;
  } finally { issueSaving = false; }
}
/** @v2 rawSplitPrint */
export async function rawSplitPrint(session: Session, input: { splitId: string; barcode: string; driverUrl: string;
  printer: string; printMode: string }): Promise<void> {
  const scope = rawSplitScope();
  const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ split_id: input.splitId,
      barcode: input.barcode, driver_url: input.driverUrl, printer: input.printer, print_mode: input.printMode }),
  }, () => guard(scope));
  const row = await responseObject(response);
  if (row.ok !== true || row.status !== 'done' || row.barcode !== input.barcode) throw new Error('Chop etish tasdiqlanmadi');
}

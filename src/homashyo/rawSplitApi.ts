import Storage from 'expo-sqlite/kv-store';
import type { Session } from '../auth';
import { currentSession } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
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
/** Capture one exact login and one issued witness for the lifetime of this role owner. */
export type RawSplitSessionTicket = { readonly session: Session; check(): void };
export type RawSplitEpochReader = (session: Session) => number | null;
const issuedTickets = new WeakSet<RawSplitSessionTicket>();
export function createRawSplitSessionTicket(session: Session, readEpoch: RawSplitEpochReader, isWitnessCurrent: () => boolean): RawSplitSessionTicket {
  const epoch = readEpoch(session), scope = rawSplitScope(); let retired = false;
  const checkWitness = () => {
    if (retired || !isSynchronouslyTrue(isWitnessCurrent)) { retired = true; throw new Error('Akkaunt o‘zgargan'); }
  };
  const check = () => {
    if (session.token === 'test-mode-token') { retired = true; throw new Error('Demo/test rejimi hozir mavjud emas.'); }
    checkWitness();
    if (currentSession() !== session || readEpoch(session) !== epoch || typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) {
      retired = true; throw new Error('Akkaunt o‘zgargan');
    }
    try { if (rawSplitScope() !== scope) throw new Error('Akkaunt o‘zgargan'); } catch { retired = true; throw new Error('Akkaunt o‘zgargan'); }
    checkWitness();
    if (currentSession() !== session || readEpoch(session) !== epoch) { retired = true; throw new Error('Akkaunt o‘zgargan'); }
  };
  check(); const ticket: RawSplitSessionTicket = { session, check };
  issuedTickets.add(ticket); return Object.freeze(ticket);
}
/** Native has no full V2 test-mode store yet. Never transmit a demo-token mutation or print. */
export function requireRawSplitRealAccount(ticket: RawSplitSessionTicket): void {
  if (ticket.session.token === 'test-mode-token') throw new Error('Demo/test rejimi hozir mavjud emas.');
}
export function rawSplitSessionIsCurrent(ticket: RawSplitSessionTicket): boolean {
  try { if (!issuedTickets.has(ticket)) return false; ticket.check(); return currentSession() === ticket.session; } catch { return false; }
}
function guard(scope: string, ticket: RawSplitSessionTicket): void {
  if (!issuedTickets.has(ticket)) throw new Error('Sessiya tekshiruvi kerak');
  ticket.check();
  if (currentSession() !== ticket.session) throw new Error('Akkaunt o‘zgargan');
  try { if (rawSplitScope() === scope) return; } catch { /* Account was removed or lost permission. */ }
  throw new Error('Akkaunt o‘zgargan');
}
function parsePending(raw: string | null): Json | null { return raw === null ? null : object(JSON.parse(raw)); }

/** @v2 rawSplitPending */
export async function rawSplitPending(ticket: RawSplitSessionTicket): Promise<Json | null> {
  const scope = rawSplitScope(); guard(scope, ticket);
  const raw = await Storage.getItemAsync(scope); guard(scope, ticket); return parsePending(raw);
}
/** @v2 rawSplitIssuePending */
export async function rawSplitIssuePending(ticket: RawSplitSessionTicket): Promise<Json | null> {
  const scope = rawSplitScope(); guard(scope, ticket);
  const raw = await Storage.getItemAsync(`${scope}:issue`); guard(scope, ticket); return parsePending(raw);
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
async function guardedResponseObject(response: Response, scope: string, ticket: RawSplitSessionTicket): Promise<Json> {
  try { const row = await responseObject(response); guard(scope, ticket); return row; }
  catch (error) { guard(scope, ticket); throw error; }
}
async function read(ticket: RawSplitSessionTicket, path: string, query?: URLSearchParams): Promise<Json> {
  const { session } = ticket, scope = rawSplitScope(); guard(scope, ticket);
  const response = await authorizedFetch(session, `/v1/mobile/raw-material-split/${path}${query ? `?${query}` : ''}`,
    {}, () => guard(scope, ticket));
  guard(scope, ticket); return guardedResponseObject(response, scope, ticket);
}
/** @v2 rawSplitSnapshot */
export async function rawSplitSnapshot(ticket: RawSplitSessionTicket): Promise<RawSplitSnapshot> {
  return new RawSplitSnapshot(await read(ticket, 'snapshot'));
}
/** @v2 rawSplitSource */
export async function rawSplitSource(ticket: RawSplitSessionTicket, barcode: string): Promise<RawSplitRoll> {
  const result = new RawSplitRoll(await read(ticket, 'source', new URLSearchParams({ barcode: barcode.trim() })));
  if (result.revision === null || !result.revision) throw new Error('Rulon versiyasi olinmadi');
  return result;
}
const definitiveErrors = new Set(['raw_split_invalid', 'raw_split_conflict', 'raw_split_scope']);
async function removePending(key: string, serialized: string, scope: string, ticket: RawSplitSessionTicket): Promise<boolean> {
  guard(scope, ticket);
  let removed: boolean;
  try { removed = await Storage.removeItemAsync(key); }
  catch (error) {
    // Removal may have completed before throwing. Never overwrite a newer pending command.
    await Storage.setItemAsync(key, previous => previous ?? serialized); throw error;
  }
  try { guard(scope, ticket); }
  catch (error) {
    // A new login of the same account must see the uncertain request. Do not overwrite a newer key.
    await Storage.setItemAsync(key, previous => previous ?? serialized); throw error;
  }
  if (!removed) await Storage.setItemAsync(key, previous => previous ?? serialized);
  return removed;
}
async function clearDefinitiveRejection(response: Response, key: string, serialized: string, scope: string, ticket: RawSplitSessionTicket): Promise<void> {
  if (response.status < 400 || response.status >= 500) return;
  let code: unknown;
  try { code = object(await response.clone().json()).code; } catch { return; }
  guard(scope, ticket);
  if (typeof code === 'string' && definitiveErrors.has(code)) await removePending(key, serialized, scope, ticket);
}
let saving = false, issueSaving = false;
/** @v2 rawSplitSave */
export async function rawSplitSave(ticket: RawSplitSessionTicket, payload: Json): Promise<RawSplitResult> {
  requireRawSplitRealAccount(ticket); const { session } = ticket;
  if (saving) throw new Error('Saqlash davom etmoqda');
  saving = true;
  try {
    const scope = rawSplitScope(); guard(scope, ticket);
    const raw = await Storage.getItemAsync(scope); guard(scope, ticket); const pending = parsePending(raw) ?? { ...payload };
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi operatsiya natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(scope, serialized); guard(scope, ticket);
    const persisted = await Storage.getItemAsync(scope); guard(scope, ticket);
    if (persisted !== serialized) throw new Error('So‘rov kaliti saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/split',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope, ticket));
    guard(scope, ticket); await clearDefinitiveRejection(response, scope, serialized, scope, ticket); guard(scope, ticket);
    const row = await guardedResponseObject(response, scope, ticket); const result = new RawSplitResult(row);
    if (result.issueId !== (pending.issue_id ?? null)) throw new Error('Muammo qaydi bilan saqlash tasdiqlanmadi');
    if (!await removePending(scope, serialized, scope, ticket)) throw new Error('Operatsiya natijasini qayta tekshiring');
    guard(scope, ticket); return result;
  } finally { saving = false; }
}
/** @v2 rawSplitReportIssue */
export async function rawSplitReportIssue(ticket: RawSplitSessionTicket, payload: Json): Promise<RawSplitIssue> {
  requireRawSplitRealAccount(ticket); const { session } = ticket;
  if (issueSaving) throw new Error('Muammo saqlanmoqda');
  issueSaving = true;
  try {
    const scope = rawSplitScope(), key = `${scope}:issue`; guard(scope, ticket);
    const raw = await Storage.getItemAsync(key); guard(scope, ticket); const pending = parsePending(raw) ?? payload;
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi muammo natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(key, serialized); guard(scope, ticket);
    const persisted = await Storage.getItemAsync(key); guard(scope, ticket);
    if (persisted !== serialized) throw new Error('Muammo so‘rovi saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/issues',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope, ticket));
    guard(scope, ticket); await clearDefinitiveRejection(response, key, serialized, scope, ticket); guard(scope, ticket);
    const row = await guardedResponseObject(response, scope, ticket); const result = new RawSplitIssue(row);
    const command = object(pending.command), outputs = command.outputs;
    if (!Array.isArray(outputs) || typeof pending.note !== 'string' || result.requestId !== command.request_id ||
      result.source.barcode !== command.source_barcode || result.note !== pending.note.trim() || result.enteredWaste !== command.waste_kg ||
      result.outputs.length !== outputs.length || result.outputs.some((output, i) => Object.entries(output).some(([key, value]) =>
        object(outputs[i])[key] !== value))) throw new Error('Boshqa muammoning javobi olindi');
    if (!await removePending(key, serialized, scope, ticket)) throw new Error('Muammo natijasini qayta tekshiring');
    guard(scope, ticket); return result;
  } finally { issueSaving = false; }
}
/** @v2 rawSplitPrint */
export async function rawSplitPrint(ticket: RawSplitSessionTicket, input: { splitId: string; barcode: string; driverUrl: string;
  printer: string; printMode: string }): Promise<void> {
  requireRawSplitRealAccount(ticket); const { session } = ticket, scope = rawSplitScope(); guard(scope, ticket);
  const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ split_id: input.splitId,
      barcode: input.barcode, driver_url: input.driverUrl, printer: input.printer, print_mode: input.printMode }),
  }, () => guard(scope, ticket));
  guard(scope, ticket); const row = await guardedResponseObject(response, scope, ticket);
  if (row.ok !== true || row.status !== 'done' || row.barcode !== input.barcode) throw new Error('Chop etish tasdiqlanmadi');
}

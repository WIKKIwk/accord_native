import Storage from 'expo-sqlite/kv-store';
import type { Session } from '../auth';
import { currentSession } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { RawSplitFormatException, RawSplitIssue, RawSplitResult, RawSplitRoll, RawSplitSnapshot } from './rawSplitModel';
import { assertRawSplitResultMatchesPending } from './rawSplitResultMatch';
import { rawSplitWriteDispatchAllowed } from './rawSplitWritePolicy';

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
function guard(scope: string, ticket: RawSplitSessionTicket, actionGuard?: () => void): void {
  actionGuard?.();
  if (!issuedTickets.has(ticket)) throw new Error('Sessiya tekshiruvi kerak');
  ticket.check();
  if (currentSession() !== ticket.session) throw new Error('Akkaunt o‘zgargan');
  let current = false;
  try { current = rawSplitScope() === scope; } catch { /* Account was removed or lost permission. */ }
  if (!current) throw new Error('Akkaunt o‘zgargan');
  actionGuard?.();
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
async function guardedResponseObject(response: Response, scope: string, ticket: RawSplitSessionTicket, actionGuard?: () => void): Promise<Json> {
  try { const row = await responseObject(response); guard(scope, ticket, actionGuard); return row; }
  catch (error) { guard(scope, ticket, actionGuard); throw error; }
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
  if (result.revision === null || !result.revision) throw new RawSplitFormatException('Rulon versiyasi olinmadi');
  return result;
}
const definitiveErrors = new Set(['raw_split_invalid', 'raw_split_conflict', 'raw_split_scope']);
class RawSplitPendingChanged extends Error {
  readonly code = 'raw_split_pending_changed';
  constructor() { super('Operatsiya natijasini qayta tekshiring'); }
}
async function restorePending(key: string, serialized: string): Promise<void> {
  await Storage.setItemAsync(key, previous => previous ?? serialized);
}
async function removePending(key: string, serialized: string, scope: string, ticket: RawSplitSessionTicket, actionGuard?: () => void): Promise<boolean> {
  guard(scope, ticket, actionGuard);
  let removed: boolean;
  try { removed = await Storage.removeItemAsync(key); }
  catch (error) {
    // Removal may have completed before throwing. Never overwrite a newer pending command.
    await restorePending(key, serialized); throw error;
  }
  try { guard(scope, ticket, actionGuard); }
  catch (error) {
    // A new login of the same account must see the uncertain request. Do not overwrite a newer key.
    await restorePending(key, serialized); throw error;
  }
  if (!removed) await restorePending(key, serialized);
  return removed;
}
async function clearDefinitiveRejection(response: Response, key: string, serialized: string, scope: string, ticket: RawSplitSessionTicket, actionGuard?: () => void): Promise<boolean> {
  if (response.status < 400 || response.status >= 500) return false;
  let code: unknown;
  try { code = object(await response.clone().json()).code; } catch { return false; }
  guard(scope, ticket, actionGuard);
  return typeof code === 'string' && definitiveErrors.has(code)
    ? await removePending(key, serialized, scope, ticket, actionGuard) : false;
}
let saving = false, issueSaving = false;
/** @v2 rawSplitSave */
export async function rawSplitSave(ticket: RawSplitSessionTicket, payload: Json, actionGuard?: () => void, requireExisting = false): Promise<RawSplitResult> {
  requireRawSplitRealAccount(ticket);
  if (!rawSplitWriteDispatchAllowed()) throw new Error('Saqlash xavfsizlik tekshiruvi tugaguncha to‘xtatilgan');
  const { session } = ticket;
  if (saving) throw new Error('Saqlash davom etmoqda');
  saving = true;
  try {
    const scope = rawSplitScope(); guard(scope, ticket, actionGuard);
    const raw = await Storage.getItemAsync(scope); guard(scope, ticket, actionGuard); const existing = parsePending(raw);
    if (requireExisting && (existing === null || JSON.stringify(existing) !== JSON.stringify(payload))) throw new RawSplitPendingChanged();
    const pending = existing ?? { ...payload };
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi operatsiya natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(scope, serialized); guard(scope, ticket, actionGuard);
    const persisted = await Storage.getItemAsync(scope); guard(scope, ticket, actionGuard);
    if (persisted !== serialized) throw new Error('So‘rov kaliti saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/split',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope, ticket, actionGuard));
    guard(scope, ticket, actionGuard);
    const cleared = await clearDefinitiveRejection(response, scope, serialized, scope, ticket, actionGuard);
    try { guard(scope, ticket, actionGuard); } catch (error) { if (cleared) await restorePending(scope, serialized); throw error; }
    const row = await guardedResponseObject(response, scope, ticket, actionGuard); const result = new RawSplitResult(row);
    if (result.issueId !== (pending.issue_id ?? null)) throw new Error('Muammo qaydi bilan saqlash tasdiqlanmadi');
    assertRawSplitResultMatchesPending(result, pending);
    const removed = await removePending(scope, serialized, scope, ticket, actionGuard);
    try { guard(scope, ticket, actionGuard); } catch (error) { if (removed) await restorePending(scope, serialized); throw error; }
    if (!removed) throw new Error('Operatsiya natijasini qayta tekshiring');
    return result;
  } finally { saving = false; }
}
/** @v2 rawSplitReportIssue */
export async function rawSplitReportIssue(ticket: RawSplitSessionTicket, payload: Json, actionGuard?: () => void, requireExisting = false): Promise<RawSplitIssue> {
  requireRawSplitRealAccount(ticket);
  if (!rawSplitWriteDispatchAllowed()) throw new Error('Muammo qaydi xavfsizlik tekshiruvi tugaguncha to‘xtatilgan');
  const { session } = ticket;
  if (issueSaving) throw new Error('Muammo saqlanmoqda');
  issueSaving = true;
  try {
    const scope = rawSplitScope(), key = `${scope}:issue`; guard(scope, ticket, actionGuard);
    const raw = await Storage.getItemAsync(key); guard(scope, ticket, actionGuard); const existing = parsePending(raw);
    if (requireExisting && (existing === null || JSON.stringify(existing) !== JSON.stringify(payload))) throw new RawSplitPendingChanged();
    const pending = existing ?? payload;
    if (JSON.stringify(pending) !== JSON.stringify(payload)) throw new Error('Avval oldingi muammo natijasini tekshiring');
    const serialized = JSON.stringify(pending);
    await Storage.setItemAsync(key, serialized); guard(scope, ticket, actionGuard);
    const persisted = await Storage.getItemAsync(key); guard(scope, ticket, actionGuard);
    if (persisted !== serialized) throw new Error('Muammo so‘rovi saqlanmadi');
    const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/issues',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }, () => guard(scope, ticket, actionGuard));
    guard(scope, ticket, actionGuard);
    const cleared = await clearDefinitiveRejection(response, key, serialized, scope, ticket, actionGuard);
    try { guard(scope, ticket, actionGuard); } catch (error) { if (cleared) await restorePending(key, serialized); throw error; }
    const row = await guardedResponseObject(response, scope, ticket, actionGuard); const result = new RawSplitIssue(row);
    const command = object(pending.command), outputs = command.outputs;
    if (!Array.isArray(outputs) || typeof pending.note !== 'string' || result.requestId !== command.request_id ||
      result.source.barcode !== command.source_barcode || result.note !== pending.note.trim() || result.enteredWaste !== command.waste_kg ||
      result.outputs.length !== outputs.length || result.outputs.some((output, i) => Object.entries(output).some(([key, value]) =>
        object(outputs[i])[key] !== value))) throw new Error('Boshqa muammoning javobi olindi');
    const removed = await removePending(key, serialized, scope, ticket, actionGuard);
    try { guard(scope, ticket, actionGuard); } catch (error) { if (removed) await restorePending(key, serialized); throw error; }
    if (!removed) throw new Error('Muammo natijasini qayta tekshiring');
    return result;
  } finally { issueSaving = false; }
}
/** @v2 rawSplitPrint */
export async function rawSplitPrint(ticket: RawSplitSessionTicket, input: { splitId: string; barcode: string; driverUrl: string;
  printer: string; printMode: string }, actionGuard?: () => void): Promise<void> {
  requireRawSplitRealAccount(ticket);
  if (!rawSplitWriteDispatchAllowed()) throw new Error('Chop etish xavfsizlik tekshiruvi tugaguncha to‘xtatilgan');
  const { session } = ticket, scope = rawSplitScope(); guard(scope, ticket, actionGuard);
  const response = await authorizedFetch(session, '/v1/mobile/raw-material-split/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ split_id: input.splitId,
      barcode: input.barcode, driver_url: input.driverUrl, printer: input.printer, print_mode: input.printMode }),
  }, () => guard(scope, ticket, actionGuard));
  guard(scope, ticket, actionGuard); const row = await guardedResponseObject(response, scope, ticket, actionGuard);
  if (row.ok !== true || row.status !== 'done' || row.barcode !== input.barcode) throw new Error('Chop etish tasdiqlanmadi');
}

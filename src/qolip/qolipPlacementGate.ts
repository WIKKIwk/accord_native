import { trimDart } from './qolipApiCommon';

/**
 * An injected lease must be valid only for a fully installed, stable session.
 * It must become false permanently as soon as login, logout, account replacement
 * or authorization-scope change begins, including same-epoch A→B→A changes.
 * `ownerScopeKey` is a stable SHA-256 digest of the server, authenticated account,
 * role and full authorization scope, not a token or credential. `generation`
 * is an opaque unique, nonsecret witness; `currentGeneration` is a synchronous
 * side-effect-free read that changes before every auth transition. No production
 * lease provider is supplied in this role branch.
 */
export type QolipPlacementSessionLease = {
  readonly ownerScopeKey: string;
  readonly generation: string;
  currentGeneration: () => string;
  isCurrent: () => boolean;
};
/**
 * This adapter must serialize every read-modify-write atomically across all
 * wrappers and processes sharing the durable store. It must commit the complete
 * next value durably before resolving. It must call `update` exactly once; the
 * callback performs no I/O. An ambiguous commit must reject. Keep raw journal
 * access inside the trusted gate service, not in account UI or the evidence
 * provider. No production adapter is supplied.
 */
export type QolipPlacementAtomicJournal = {
  transact<T>(update: (current: string | null) => { next?: string; value: T }): Promise<T>;
};
export type QolipPlacementTarget = { block: string; warehouse: string; rowLetter: string; columnNumber: number };
type ItemStatus = 'waiting' | 'uncertain' | 'confirmed';
export type QolipPlacementJournalItem = { code: string; status: ItemStatus };
export type QolipPlacementPending = { target: QolipPlacementTarget; closed: boolean; items: QolipPlacementJournalItem[] };
type StoredItem = QolipPlacementJournalItem & { body: string };
type StoredPending = Omit<QolipPlacementPending, 'items'> & { id: number; revision: number; ownerScopeKey: string; items: StoredItem[] };
type OriginState = { origin: string; pending: StoredPending };
type Journal = { version: 1; nextId: number; origins: OriginState[] };
/**
 * `not_applied` requires proof that every sent command is definitively settled
 * and did not commit, followed by an exhaustive authoritative refresh under the
 * same account and scope. A timeout, filtered location list, or an earlier read
 * is not proof. `applied` requires explicit review and never auto-retries. No
 * production evidence provider is supplied in this role branch.
 */
export type QolipPlacementEvidence = { kind: 'unknown' } | { kind: 'applied' } | { kind: 'not_applied' };
export type QolipPlacementAuthority = {
  readAfterVerifiedSettlement: (pending: QolipPlacementPending, lease: QolipPlacementSessionLease) => Promise<QolipPlacementEvidence>;
};
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const validOwner = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validCode = (value: string) => /^[\x21-\x7e]+$/.test(value);
// Ignore accidental asynchronous providers without leaking an unhandled rejection.
function synchronous(value: unknown): unknown {
  if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
    try {
      if (typeof (value as { then?: unknown }).then === 'function') void Promise.resolve(value).catch(() => {});
    } catch { /* An invalid thenable is never accepted as a synchronous answer. */ }
  }
  return value;
}
function stable(lease: QolipPlacementSessionLease, owner: string, generation: string): boolean {
  try {
    if (synchronous(lease.ownerScopeKey) !== owner || synchronous(lease.generation) !== generation ||
        synchronous(lease.currentGeneration()) !== generation) return false;
    if (synchronous(lease.isCurrent()) !== true) return false;
    return synchronous(lease.currentGeneration()) === generation && synchronous(lease.ownerScopeKey) === owner &&
      synchronous(lease.generation) === generation;
  } catch { return false; }
}
function serverOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid Qolip placement server');
  }
  return url.origin;
}
function validTarget(value: unknown): value is QolipPlacementTarget {
  return isObject(value) && typeof value.block === 'string' && typeof value.warehouse === 'string' &&
    typeof value.rowLetter === 'string' && Number.isSafeInteger(value.columnNumber);
}
function validBody(code: string, target: QolipPlacementTarget, body: string): boolean {
  let value: unknown;
  try { value = JSON.parse(body); } catch { return false; }
  if (!isObject(value) || JSON.stringify(value) !== body) return false;
  const keys = new Set(['block', 'warehouse', 'item_code', 'item_name', 'qolip_code', 'size', 'quantity', 'row_letter', 'column_number']);
  if (Object.keys(value).some(key => !keys.has(key)) || value.block !== target.block || value.warehouse !== target.warehouse ||
      value.qolip_code !== code || value.quantity !== 1 || value.column_number !== target.columnNumber ||
      (target.rowLetter ? value.row_letter !== target.rowLetter : Object.hasOwn(value, 'row_letter')) ||
      (Object.hasOwn(value, 'item_code') && typeof value.item_code !== 'string') ||
      (Object.hasOwn(value, 'item_name') && typeof value.item_name !== 'string') ||
      (Object.hasOwn(value, 'size') && (!Number.isSafeInteger(value.size) || (value.size as number) <= 0))) return false;
  return true;
}
function normalizedTarget(target: QolipPlacementTarget): QolipPlacementTarget {
  return { block: trimDart(target.block), warehouse: trimDart(target.warehouse), rowLetter: trimDart(target.rowLetter), columnNumber: target.columnNumber };
}
function bump(pending: StoredPending) {
  if (pending.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Qolip placement journal revision exhausted');
  pending.revision++;
}
function validPending(value: unknown): value is StoredPending {
  if (!isObject(value) || !Number.isSafeInteger(value.id) || (value.id as number) < 1 || !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 1 || !validOwner(value.ownerScopeKey) || typeof value.closed !== 'boolean' ||
      !validTarget(value.target) || !Array.isArray(value.items) || !value.items.length) return false;
  const target = value.target as QolipPlacementTarget;
  if (JSON.stringify(target) !== JSON.stringify(normalizedTarget(target))) return false;
  if (!value.items.every(item => isObject(item) && typeof item.code === 'string' && validCode(item.code) &&
    typeof item.body === 'string' && validBody(item.code, target, item.body) &&
    (item.status === 'waiting' || item.status === 'uncertain' || item.status === 'confirmed'))) return false;
  const items = value.items as StoredItem[], codes = items.map(item => item.code.toLowerCase());
  if (new Set(codes).size !== codes.length || (value.closed && items.every(item => item.status === 'waiting'))) return false;
  let phase = 0;
  for (const item of items) {
    if (item.status === 'confirmed' && phase !== 0) return false;
    if (item.status === 'uncertain') { if (phase !== 0) return false; phase = 1; }
    if (item.status === 'waiting') phase = 2;
  }
  return true;
}
function parseJournal(raw: string | null): Journal {
  if (raw === null) return { version: 1, nextId: 1, origins: [] };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Qolip placement journal is corrupt'); }
  if (!isObject(value) || value.version !== 1 || !Number.isSafeInteger(value.nextId) || (value.nextId as number) < 1 || !Array.isArray(value.origins)) {
    throw new Error('Qolip placement journal is corrupt');
  }
  if (value.origins.length > 1) throw new Error('Qolip placement journal is corrupt');
  const origins = new Set<string>(), ids = new Set<number>();
  for (const entry of value.origins) {
    if (!isObject(entry) || typeof entry.origin !== 'string' || !validPending(entry.pending)) throw new Error('Qolip placement journal is corrupt');
    try { if (serverOrigin(entry.origin) !== entry.origin) throw new Error(); } catch { throw new Error('Qolip placement journal is corrupt'); }
    if (origins.has(entry.origin) || ids.has(entry.pending.id) || entry.pending.id >= (value.nextId as number)) {
      throw new Error('Qolip placement journal is corrupt');
    }
    origins.add(entry.origin); ids.add(entry.pending.id);
  }
  return value as Journal;
}
function copyStored(value: StoredPending): StoredPending {
  return { ...value, target: { ...value.target }, items: value.items.map(item => ({ ...item })) };
}
function publicPending(value: StoredPending): QolipPlacementPending {
  return { target: { ...value.target }, closed: value.closed, items: value.items.map(item => ({ code: item.code, status: item.status })) };
}
function contextOf(lease: QolipPlacementSessionLease): { owner: string; generation: string } {
  if (!lease) throw new TypeError('Verified Qolip session lease is required');
  const owner = synchronous(lease.ownerScopeKey), generation = synchronous(lease.generation);
  if (!validOwner(owner) || typeof generation !== 'string' || !generation ||
      typeof lease.currentGeneration !== 'function' || typeof lease.isCurrent !== 'function') throw new TypeError('Verified Qolip session lease is required');
  return { owner, generation };
}
// The eventual transport must send this exact immutable request and call its
// single-use beforeSend immediately before the wire operation. It is not wired.
export type QolipPlacementWireRequest = Readonly<{ origin: string; method: 'POST'; path: '/v1/mobile/qolip/locations'; body: string }>;
export type QolipPlacementReservation = {
  markSending: (index: number) => Promise<{ request: QolipPlacementWireRequest; beforeSend: () => void } | null>;
  markOutcome: (index: number, succeeded: boolean) => Promise<void>;
  close: () => Promise<void>;
};
export type QolipPlacementReservationResult = { kind: 'reserved'; reservation: QolipPlacementReservation }
  | { kind: 'reconcile_required' } | { kind: 'unsupported_code' } | { kind: 'duplicate_code' } | { kind: 'session_changed' };
export type QolipPlacementInspection = { kind: 'clear' } | { kind: 'owned'; pending: QolipPlacementPending }
  | { kind: 'reconcile_required' } | { kind: 'session_changed' };
export type QolipPlacementReconcileResult = { kind: 'clear' } | { kind: 'reconciled' } | { kind: 'in_flight' }
  | { kind: 'unknown' } | { kind: 'applied_review_required' } | { kind: 'reconcile_required' }
  | { kind: 'session_changed' } | { kind: 'changed' };

/** A device-wide hold also covers server aliases and avoids Unicode case folding. */
export class QolipPlacementGate {
  constructor(private readonly journal: QolipPlacementAtomicJournal) {
    if (!journal || typeof journal.transact !== 'function') throw new TypeError('Atomic durable Qolip journal is required');
  }
  async reserve(input: { origin: string; actions: readonly { code: string; body: string }[]; target: QolipPlacementTarget;
    lease: QolipPlacementSessionLease }): Promise<QolipPlacementReservationResult> {
    const origin = serverOrigin(input.origin), lease = input.lease, { owner, generation } = contextOf(lease);
    if (!Array.isArray(input.actions) || !input.actions.length || input.actions.some(action => !isObject(action) ||
        typeof action.code !== 'string' || typeof action.body !== 'string') || !validTarget(input.target)) {
      throw new TypeError('Invalid Qolip placement intent');
    }
    const target = normalizedTarget(input.target), actions = input.actions.map(action => ({ code: trimDart(action.code), body: action.body }));
    if (input.actions.some(action => /[^\x00-\x7f]/.test(action.code)) || actions.some(action => !validCode(action.code))) {
      return { kind: 'unsupported_code' };
    }
    if (new Set(actions.map(action => action.code.toLowerCase())).size !== actions.length) return { kind: 'duplicate_code' };
    if (actions.some(action => !validBody(action.code, target, action.body))) throw new TypeError('Invalid Qolip placement request body');
    const result = await this.journal.transact<{ kind: 'session_changed' } | { kind: 'reconcile_required' } | { kind: 'reserved'; id: number }>(current => {
      if (!stable(lease, owner, generation)) return { value: { kind: 'session_changed' as const } };
      const journal = parseJournal(current);
      if (journal.origins.length) return { value: { kind: 'reconcile_required' as const } };
      if (journal.nextId >= Number.MAX_SAFE_INTEGER) throw new Error('Qolip placement journal is full');
      const pending: StoredPending = { id: journal.nextId++, revision: 1, ownerScopeKey: owner, target,
        closed: false, items: actions.map(action => ({ ...action, status: 'waiting' })) };
      journal.origins.push({ origin, pending });
      return { value: { kind: 'reserved' as const, id: pending.id }, next: JSON.stringify(journal) };
    });
    if (result.kind !== 'reserved') return stable(lease, owner, generation) ? result : { kind: 'session_changed' };
    const reservation = new Reservation(this.journal, origin, result.id, lease, owner, generation);
    if (!stable(lease, owner, generation)) { await reservation.close(); return { kind: 'session_changed' }; }
    return { kind: 'reserved', reservation };
  }
  async inspect(input: { origin: string; lease: QolipPlacementSessionLease }): Promise<QolipPlacementInspection> {
    const origin = serverOrigin(input.origin), lease = input.lease, { owner, generation } = contextOf(lease);
    const result = await this.journal.transact<QolipPlacementInspection>(current => {
      if (!stable(lease, owner, generation)) return { value: { kind: 'session_changed' as const } };
      const entry = parseJournal(current).origins[0], pending = entry?.pending;
      if (!pending) return { value: { kind: 'clear' as const } };
      if (entry.origin !== origin || pending.ownerScopeKey !== owner) return { value: { kind: 'reconcile_required' as const } };
      return { value: { kind: 'owned' as const, pending: publicPending(pending) } };
    });
    return stable(lease, owner, generation) ? result : { kind: 'session_changed' };
  }
  async reconcile(input: { origin: string; lease: QolipPlacementSessionLease; authority: QolipPlacementAuthority }): Promise<QolipPlacementReconcileResult> {
    const origin = serverOrigin(input.origin), lease = input.lease, { owner, generation } = contextOf(lease), { authority } = input;
    if (!authority || typeof authority.readAfterVerifiedSettlement !== 'function') throw new TypeError('Verified Qolip reconciliation authority is required');
    const readEvidence = authority.readAfterVerifiedSettlement.bind(authority);
    const snapshot = await this.journal.transact<{ kind: 'session_changed' | 'clear' | 'reconcile_required' | 'in_flight' } |
      { kind: 'snapshot'; pending: StoredPending }>(current => {
      if (!stable(lease, owner, generation)) return { value: { kind: 'session_changed' as const } };
      const entry = parseJournal(current).origins[0], pending = entry?.pending;
      if (!pending) return { value: { kind: 'clear' as const } };
      if (entry.origin !== origin || pending.ownerScopeKey !== owner) return { value: { kind: 'reconcile_required' as const } };
      if (!pending.closed) return { value: { kind: 'in_flight' as const } };
      return { value: { kind: 'snapshot' as const, pending: copyStored(pending) } };
    });
    if (!stable(lease, owner, generation)) return { kind: 'session_changed' };
    if (snapshot.kind !== 'snapshot') return snapshot;
    const evidence = await readEvidence(publicPending(snapshot.pending), lease);
    if (!stable(lease, owner, generation)) return { kind: 'session_changed' };
    const kind = evidence?.kind;
    if (!stable(lease, owner, generation)) return { kind: 'session_changed' };
    if (!evidence || (kind !== 'unknown' && kind !== 'applied' && kind !== 'not_applied')) {
      throw new TypeError('Invalid Qolip reconciliation evidence');
    }
    const reconciled = await this.journal.transact<QolipPlacementReconcileResult>(current => {
      if (!stable(lease, owner, generation)) return { value: { kind: 'session_changed' as const } };
      const journal = parseJournal(current), index = journal.origins.findIndex(entry => entry.origin === origin);
      const pending = journal.origins[index]?.pending;
      if (!pending || pending.ownerScopeKey !== owner || pending.id !== snapshot.pending.id || pending.revision !== snapshot.pending.revision || !pending.closed) {
        return { value: { kind: 'changed' as const } };
      }
      if (kind === 'unknown') return { value: { kind: 'unknown' as const } };
      if (kind === 'applied' || pending.items.some(item => item.status === 'confirmed')) {
        return { value: { kind: 'applied_review_required' as const } };
      }
      journal.origins.splice(index, 1);
      return { value: { kind: 'reconciled' as const }, next: JSON.stringify(journal) };
    });
    return stable(lease, owner, generation) ? reconciled : { kind: 'session_changed' };
  }
}

class Reservation implements QolipPlacementReservation {
  private closed = false;
  private preparing = false;
  private finishing = false;
  private invoked = false;
  private allowedIndex: number | null = null;
  private closing: Promise<void> | null = null;
  constructor(private readonly journal: QolipPlacementAtomicJournal, private readonly origin: string, private readonly id: number,
    private readonly lease: QolipPlacementSessionLease, private readonly owner: string, private readonly generation: string) {}
  async markSending(index: number): Promise<{ request: QolipPlacementWireRequest; beforeSend: () => void } | null> {
    if (this.preparing || this.allowedIndex !== null || this.closed || this.closing) throw new Error('Qolip placement is already sending');
    this.preparing = true;
    try {
      const marked = await this.journal.transact<{ body: string } | null>(current => {
        if (this.closed || !stable(this.lease, this.owner, this.generation)) return { value: null };
        const journal = parseJournal(current), pending = journal.origins.find(entry => entry.origin === this.origin)?.pending;
        if (!pending || pending.ownerScopeKey !== this.owner || pending.id !== this.id || pending.closed ||
            !Number.isSafeInteger(index) || !pending.items[index] || pending.items[index].status !== 'waiting') {
          throw new Error('Invalid Qolip placement reservation');
        }
        if (pending.items.some(item => item.status === 'uncertain')) throw new Error('Previous Qolip placement outcome is uncertain');
        pending.items[index].status = 'uncertain'; bump(pending);
        return { value: { body: pending.items[index].body }, next: JSON.stringify(journal) };
      });
      if (!marked || !stable(this.lease, this.owner, this.generation)) return null;
      this.allowedIndex = index; this.invoked = false;
      const request: QolipPlacementWireRequest = Object.freeze({ origin: this.origin, method: 'POST', path: '/v1/mobile/qolip/locations', body: marked.body });
      return { request, beforeSend: () => {
        if (this.closed || this.closing || this.allowedIndex !== index || !stable(this.lease, this.owner, this.generation)) {
          throw new Error('Qolip placement session changed or request not journaled');
        }
        if (this.invoked) throw new Error('Qolip placement was already sent');
        this.invoked = true;
      } };
    } finally { this.preparing = false; }
  }
  async markOutcome(index: number, succeeded: boolean): Promise<void> {
    if (this.closed || this.closing || this.finishing || this.allowedIndex !== index) throw new Error('Invalid Qolip placement outcome');
    this.finishing = true;
    try {
      const confirmed = synchronous(succeeded) === true;
      if (confirmed && !this.invoked) throw new Error('Qolip placement was not sent');
      await this.journal.transact(current => {
        const journal = parseJournal(current), pending = journal.origins.find(entry => entry.origin === this.origin)?.pending;
        if (!pending || pending.ownerScopeKey !== this.owner || pending.id !== this.id || pending.closed ||
            !Number.isSafeInteger(index) || !pending.items[index] || pending.items[index].status !== 'uncertain') {
          throw new Error('Invalid Qolip placement outcome');
        }
        if (confirmed && stable(this.lease, this.owner, this.generation)) pending.items[index].status = 'confirmed';
        bump(pending);
        return { value: undefined, next: JSON.stringify(journal) };
      });
    } finally { this.allowedIndex = null; this.finishing = false; this.invoked = false; }
  }
  close(): Promise<void> {
    if (this.preparing || this.allowedIndex !== null) return Promise.reject(new Error('Qolip placement is still sending'));
    return this.closing ??= this.journal.transact(current => {
      const journal = parseJournal(current), index = journal.origins.findIndex(entry => entry.origin === this.origin);
      const pending = journal.origins[index]?.pending;
      if (!pending || pending.ownerScopeKey !== this.owner || pending.id !== this.id || pending.closed) {
        throw new Error('Invalid Qolip placement reservation close');
      }
      if (pending.items.every(item => item.status === 'waiting')) journal.origins.splice(index, 1);
      else { pending.closed = true; bump(pending); }
      return { value: undefined, next: JSON.stringify(journal) };
    }).then(() => { this.closed = true; });
  }
}

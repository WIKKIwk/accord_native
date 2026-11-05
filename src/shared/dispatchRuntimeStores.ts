import type { DispatchRecord } from './notificationApi';

type Status = DispatchRecord['status'];
type Mutation = { before: DispatchRecord | null; after: DispatchRecord; createdAt: number };
type CustomerStatusKind = 'pending' | 'confirmed' | 'rejected';
export type CustomerSummary = { pendingCount: number; confirmedCount: number; rejectedCount: number };
export type WerkaSummary = { pendingCount: number; confirmedCount: number; returnedCount: number };
export type SupplierSummary = { pendingCount: number; submittedCount: number; returnedCount: number };

class ObservableStore {
  private readonly listeners = new Set<() => void>();
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  protected notify(): void { for (const listener of this.listeners) listener(); }
}

/** @v2 parseCreatedLabelTimestamp */
export function parseCreatedLabelTimestamp(value: string): number | null {
  const match = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '', zone, sign, offsetHour = '0', offsetMinute = '0'] = match;
  const millis = Number((fraction + '000').slice(0, 3));
  const date = new Date(0);
  if (zone) {
    date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    date.setUTCHours(Number(hour), Number(minute), Number(second), millis);
  } else {
    date.setFullYear(Number(year), Number(month) - 1, Number(day));
    date.setHours(Number(hour), Number(minute), Number(second), millis);
  }
  const offset = sign ? (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === '-' ? -1 : 1) : 0;
  const result = date.getTime() - offset * 60_000;
  return Number.isFinite(result) ? result : null;
}

/** @v2 compareCreatedLabelsDesc */
export function compareCreatedLabelsDesc(left: string, right: string): number {
  const a = parseCreatedLabelTimestamp(left), b = parseCreatedLabelTimestamp(right);
  if (a !== null && b !== null) return b === a ? 0 : b > a ? 1 : -1;
  if (a !== null) return -1;
  if (b !== null) return 1;
  return right === left ? 0 : right > left ? 1 : -1;
}

const signature = (item: DispatchRecord) => [item.id, item.status, item.sent_qty.toFixed(4), item.accepted_qty.toFixed(4), item.note.trim()].join('|');
const sorted = (items: Iterable<DispatchRecord>) => [...items].sort((a, b) => compareCreatedLabelsDesc(a.created_label, b.created_label));
const customerBucket = (status: Status): CustomerStatusKind | null => status === 'pending' ? 'pending' : status === 'accepted' ? 'confirmed'
  : status === 'partial' || status === 'rejected' ? 'rejected' : null;
const werkaBucket = (status: Status): 'pending' | 'confirmed' | 'returned' => status === 'pending' || status === 'draft' ? 'pending'
  : status === 'accepted' ? 'confirmed' : 'returned';
const supplierBucket = (status: Status): 'pending' | 'submitted' | 'returned' => status === 'pending' || status === 'draft' ? 'pending'
  : status === 'accepted' ? 'submitted' : 'returned';

class RecordMutationStore extends ObservableStore {
  protected readonly mutations = new Map<string, Mutation>();
  constructor(protected readonly now: () => number = Date.now) { super(); }
  protected record(before: DispatchRecord | null, after: DispatchRecord): void {
    const id = after.id.trim(); if (!id) return;
    this.mutations.set(id, { before, after, createdAt: this.now() }); this.notify();
  }
  protected active(): Mutation[] { const now = this.now(); return [...this.mutations.values()].filter(item => now - item.createdAt <= 20_000); }
  protected reconcile(items: readonly DispatchRecord[]): void {
    const byId = new Map(items.map(item => [item.id, item]));
    for (const [id, mutation] of this.mutations) {
      const server = byId.get(id);
      if (server && signature(server) === signature(mutation.after)) this.mutations.delete(id);
    }
  }
}

/** @v2 CustomerDeliveryRuntimeStore */
export class CustomerDeliveryRuntimeStore extends RecordMutationStore {
  private readonly snapshots = new Map<CustomerStatusKind, readonly DispatchRecord[]>();
  recordIncoming(record: DispatchRecord): void { this.record(null, record); }
  recordTransition(before: DispatchRecord, after: DispatchRecord): void { this.record(before, after); }
  reconcileStatusLists(pending: readonly DispatchRecord[], confirmed: readonly DispatchRecord[], rejected: readonly DispatchRecord[]): void {
    this.reconcile([...pending, ...confirmed, ...rejected]);
  }
  setStatusSnapshot(kind: CustomerStatusKind, items: readonly DispatchRecord[]): void {
    const previous = this.snapshots.get(kind);
    if (previous && previous.length === items.length && previous.every((item, index) => signature(item) === signature(items[index]))) return;
    this.snapshots.set(kind, [...items]); this.notify();
  }
  applySummary(summary: CustomerSummary): CustomerSummary {
    const counts = { pending: this.snapshots.get('pending')?.length ?? summary.pendingCount,
      confirmed: this.snapshots.get('confirmed')?.length ?? summary.confirmedCount,
      rejected: this.snapshots.get('rejected')?.length ?? summary.rejectedCount };
    for (const mutation of this.active()) {
      const before = mutation.before && customerBucket(mutation.before.status), after = customerBucket(mutation.after.status);
      if (before) counts[before]--; if (after) counts[after]++;
    }
    return { pendingCount: Math.max(0, counts.pending), confirmedCount: Math.max(0, counts.confirmed), rejectedCount: Math.max(0, counts.rejected) };
  }
  applyStatusList(kind: CustomerStatusKind, items: readonly DispatchRecord[]): DispatchRecord[] {
    const byId = new Map(items.map(item => [item.id, item]));
    for (const { after } of this.active()) {
      if (customerBucket(after.status) === kind) byId.set(after.id, after); else byId.delete(after.id);
    }
    return sorted(byId.values());
  }
  applyHistory(items: readonly DispatchRecord[]): DispatchRecord[] {
    const byId = new Map(items.map(item => [item.id, item]));
    for (const { after } of this.active()) if (byId.has(after.id)) byId.set(after.id, after);
    return sorted(byId.values());
  }
  clear(): void { this.mutations.clear(); this.snapshots.clear(); this.notify(); }
}

/** @v2 WerkaRuntimeStore */
export class WerkaRuntimeStore extends RecordMutationStore {
  recordCreatedPending(record: DispatchRecord): void { this.record(null, record); }
  recordTransition(before: DispatchRecord, after: DispatchRecord): void { this.record(before, after); }
  reconcileWithServer(pending: readonly DispatchRecord[], history: readonly DispatchRecord[]): void { this.reconcile([...pending, ...history]); }
  applySummary(summary: WerkaSummary): WerkaSummary {
    const counts = { pending: summary.pendingCount, confirmed: summary.confirmedCount, returned: summary.returnedCount };
    for (const mutation of this.active()) {
      if (mutation.before) counts[werkaBucket(mutation.before.status)]--;
      counts[werkaBucket(mutation.after.status)]++;
    }
    return { pendingCount: Math.max(0, counts.pending), confirmedCount: Math.max(0, counts.confirmed), returnedCount: Math.max(0, counts.returned) };
  }
  applyPendingItems(items: readonly DispatchRecord[]): DispatchRecord[] {
    const byId = new Map(items.map(item => [item.id, item]));
    for (const { after } of this.active()) {
      if (werkaBucket(after.status) === 'pending') byId.set(after.id, after); else byId.delete(after.id);
    }
    return sorted(byId.values());
  }
  clear(): void { this.mutations.clear(); this.notify(); }
}

/** @v2 SupplierRuntimeStore */
export class SupplierRuntimeStore extends ObservableStore {
  private readonly mutations: { pending: number; submitted: number; returned: number; createdAt: number }[] = [];
  constructor(private readonly now: () => number = Date.now) { super(); }
  recordCreatedPending(): void { this.mutations.push({ pending: 1, submitted: 0, returned: 0, createdAt: this.now() }); this.notify(); }
  recordUnannouncedDecision(from: Status, to: Status): void {
    if (from === to) return;
    const mutation = { pending: 0, submitted: 0, returned: 0, createdAt: this.now() };
    mutation[supplierBucket(from)]--; mutation[supplierBucket(to)]++;
    this.mutations.push(mutation); this.notify();
  }
  applySummary(summary: SupplierSummary): SupplierSummary {
    const counts = { pending: summary.pendingCount, submitted: summary.submittedCount, returned: summary.returnedCount }, now = this.now();
    for (const mutation of this.mutations) if (now - mutation.createdAt <= 20_000) {
      counts.pending += mutation.pending; counts.submitted += mutation.submitted; counts.returned += mutation.returned;
    }
    return { pendingCount: Math.max(0, counts.pending), submittedCount: Math.max(0, counts.submitted), returnedCount: Math.max(0, counts.returned) };
  }
  clear(): void { this.mutations.length = 0; this.notify(); }
}

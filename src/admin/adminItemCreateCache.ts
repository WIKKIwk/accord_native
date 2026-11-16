import type { SupplierItem } from '../shared/catalogApi';
type AdminItemCreateCachedCustomer = Readonly<{ ref: string; name: string; phone: string }>;

export type AdminItemCreateListCache = Readonly<{ query: string; group: string; items: readonly SupplierItem[]; hasMore: boolean }>;
export type AdminItemCreateCustomerCache = Readonly<{ items: readonly AdminItemCreateCachedCustomer[]; hasMore: boolean }>;
export type AdminItemCreateCacheTicket = Readonly<{ namespace: string; kind: 'list' | 'customers'; version: number; reset: number }>;
/** Source has one completed list slot and a typed customer slot, with no TTL or shared in-flight jobs. */
export class AdminItemCreateMemoryCache {
  private list: { namespace: string; value: AdminItemCreateListCache } | null = null;
  private customer: { namespace: string; value: AdminItemCreateCustomerCache } | null = null;
  private resetVersion = 0; private readonly versions = new Map<string, number>();
  ticket(namespace: string, kind: 'list' | 'customers' = 'list'): AdminItemCreateCacheTicket { return Object.freeze({ namespace, kind, version: this.versions.get(`${kind}:${namespace}`) ?? 0, reset: this.resetVersion }); }
  private current(ticket: AdminItemCreateCacheTicket) { return ticket.reset === this.resetVersion && ticket.version === (this.versions.get(`${ticket.kind}:${ticket.namespace}`) ?? 0); }
  readList(namespace: string) { return this.list?.namespace === namespace ? this.list.value : null; }
  readCustomers(namespace: string) { return this.customer?.namespace === namespace ? this.customer.value : null; }
  writeList(ticket: AdminItemCreateCacheTicket, value: AdminItemCreateListCache) {
    if (ticket.kind !== 'list' || !this.current(ticket)) return; this.list = { namespace: ticket.namespace, value: Object.freeze({ ...value, items: Object.freeze([...value.items]) }) };
  }
  /** M3 picker caches its nonempty blank-query PAGE, not the accumulated buffer. */
  writeCustomers(ticket: AdminItemCreateCacheTicket, value: AdminItemCreateCustomerCache) {
    if (ticket.kind !== 'customers' || !this.current(ticket) || !value.items.length) return; this.customer = { namespace: ticket.namespace, value: Object.freeze({ ...value, items: Object.freeze([...value.items]) }) };
  }
  clearList(namespace: string) { const key = `list:${namespace}`; this.versions.set(key, (this.versions.get(key) ?? 0) + 1); if (this.list?.namespace === namespace) this.list = null; }
  clearCustomers(namespace: string) { const key = `customers:${namespace}`; this.versions.set(key, (this.versions.get(key) ?? 0) + 1); if (this.customer?.namespace === namespace) this.customer = null; }
  reset() { this.resetVersion++; this.list = null; this.customer = null; this.versions.clear(); }
}

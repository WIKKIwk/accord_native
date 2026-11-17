export type AdminRootSheetAuthorityOriginal = Readonly<{ presentationTicket: string; parentTicket: string; nativeIdentity: object }>;
export type AdminRootSheetAuthorityProducer = Readonly<{
  /** MUST synchronously publish every account/Source/child-reservation/descendant change, before the mutating callback returns. */
  subscribeSource: (changed: () => void) => (() => void);
  /** MUST synchronously publish every original native/parent/resource-membership change. */
  subscribeResource: (changed: () => void) => (() => void);
}>;
export type AdminRootSheetAuthorityStamp = Readonly<{ identity: object }>;
const issued = new WeakSet<object>(), secret = {};
const validTicket = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value)?.[0] === value;
/** Passive revision boundary, NOT a provider of authority booleans or native readiness.
 * Production integration must use actual synchronous Auth/Controller/Root-map producers; those are not wired yet.
 */
export class AdminRootSheetAuthority {
  #source: object = {}; #resource: object = {}; #disposed = false;
  #stamps = new WeakMap<object, { source: object; resource: object }>();
  #original: AdminRootSheetAuthorityOriginal; #sourceStop: (() => void) | null = null; #resourceStop: (() => void) | null = null;
  #retirement = new Set<() => void>();
  constructor(key: object, original: AdminRootSheetAuthorityOriginal) {
    if (key !== secret) throw TypeError('A subscribed original sheet authority is required'); this.#original = Object.freeze({ ...original });
  }
  /** Only the factory owns subscriptions. A caller cannot install a producer after issuance. */
  connect(key: object, producer: AdminRootSheetAuthorityProducer): boolean {
    if (key !== secret || this.#disposed) return false;
    try {
      const source = producer.subscribeSource, resource = producer.subscribeResource;
      const sourceStop: unknown = source.call(producer, () => { this.#source = {}; });
      if (typeof sourceStop !== 'function') { this.observeInvalid(sourceStop); throw TypeError('Synchronous Source cleanup is required'); }
      this.#sourceStop = sourceStop as () => void;
      const resourceStop: unknown = resource.call(producer, () => { this.#resource = {}; });
      if (typeof resourceStop !== 'function') { this.observeInvalid(resourceStop); throw TypeError('Synchronous resource cleanup is required'); }
      this.#resourceStop = resourceStop as () => void; return true;
    } catch { this.dispose(); return false; }
  }
  private observeInvalid(value: unknown) { try { if (value !== null && (typeof value === 'object' || typeof value === 'function')) void Promise.resolve(value).catch(() => {}); } catch {} }
  matchesOriginal = (original: AdminRootSheetAuthorityOriginal): boolean => !this.#disposed && original.presentationTicket === this.#original.presentationTicket && original.parentTicket === this.#original.parentTicket && original.nativeIdentity === this.#original.nativeIdentity;
  capture = (): AdminRootSheetAuthorityStamp | null => {
    if (this.#disposed) return null; const stamp = Object.freeze({ identity: Object.freeze({}) }); this.#stamps.set(stamp, { source: this.#source, resource: this.#resource }); return stamp;
  };
  /** No producer, guard, getter or other user callback runs here. */
  matches = (stamp: AdminRootSheetAuthorityStamp | null, mode: 'source' | 'all'): boolean => {
    const original = stamp && this.#stamps.get(stamp); return !this.#disposed && !!original && original.source === this.#source && (mode === 'source' || original.resource === this.#resource);
  };
  subscribeRetirement = (retired: () => void): (() => void) => {
    if (this.#disposed) { retired(); return () => {}; } this.#retirement.add(retired); return () => { this.#retirement.delete(retired); };
  };
  dispose = () => {
    if (this.#disposed) return; this.#disposed = true; this.#source = {}; this.#resource = {};
    const stops = [this.#sourceStop, this.#resourceStop]; this.#sourceStop = null; this.#resourceStop = null;
    for (const stop of stops) { try { this.observeInvalid(stop?.()); } catch {} }
    const retired = [...this.#retirement]; this.#retirement.clear(); for (const listener of retired) { try { listener(); } catch {} }
  };
}
/** A subscription contract only; module presence and arbitrary noop publishers are NOT genuine producer integration. */
export function createAdminRootSheetAuthority(original: AdminRootSheetAuthorityOriginal, producer: AdminRootSheetAuthorityProducer): AdminRootSheetAuthority | null {
  try {
    const captured = Object.freeze({ ...original }), source = producer?.subscribeSource, resource = producer?.subscribeResource;
    if (!validTicket(captured.presentationTicket) || !validTicket(captured.parentTicket) || captured.presentationTicket === captured.parentTicket || !captured.nativeIdentity || typeof captured.nativeIdentity !== 'object' || Array.isArray(captured.nativeIdentity) ||
      typeof source !== 'function' || typeof resource !== 'function') return null;
    const subscriptions = Object.freeze({ subscribeSource: (changed: () => void) => source.call(producer, changed), subscribeResource: (changed: () => void) => resource.call(producer, changed) });
    const authority = new AdminRootSheetAuthority(secret, captured); if (!authority.connect(secret, subscriptions)) return null;
    Object.freeze(authority); issued.add(authority); return authority;
  } catch { return null; }
}
export function isAdminRootSheetAuthority(value: unknown, original: AdminRootSheetAuthorityOriginal): value is AdminRootSheetAuthority {
  return !!value && typeof value === 'object' && issued.has(value) && (value as AdminRootSheetAuthority).matchesOriginal(original);
}

/**
 * UNCONNECTED, FAIL-CLOSED EXPERIMENT. Nothing in the app imports this file.
 * There is no native adapter, transport, printer, recovery marker, outcome
 * verifier or acknowledgment verifier. The role uses its existing V2 command flow.
 *
 * A missing journal may mean deletion, rollback, restoration or reinstall. Even a
 * present value can be an older valid snapshot. A caller's assertion, a version
 * number inside that value, or matching response fields cannot establish otherwise.
 * Until an independent recovery authority is implemented and reviewed, none of
 * this API's state-changing or inspection methods reads or writes a store.
 */

export type PrototypeScope = Readonly<{ serverId: string; ownerRef: string }>;
export type PrototypeLegacyObservation = Readonly<{
  writers: 'stopped' | 'active' | 'unknown';
  stockKey: 'absent' | 'present' | 'unknown';
  issueKey: 'absent' | 'present' | 'unknown';
}>;
export type PrototypeCommand = Readonly<{ kind: 'stock' | 'issue'; requestId: string; json: string }>;
export type PrototypeTransactionalStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, updater: (previous: string | null) => string): Promise<void>;
};

declare const fenceTokenBrand: unique symbol;
/** Ephemeral public handle only: it contains no caller-supplied credential or secret. */
export type PrototypeFenceToken = Readonly<{ [fenceTokenBrand]: true }>;
export type PrototypeOwner = Readonly<{ generation: number; token: PrototypeFenceToken; isCurrent: () => boolean }>;

export class PrototypeBlocked extends Error {
  constructor(readonly reason: string) { super(reason); this.name = 'PrototypeBlocked'; }
}
function block(reason: string): never { throw new PrototypeBlocked(reason); }
const issuedFenceTokens = new WeakSet<object>();

/**
 * An in-memory opaque handle, not an authentication credential or durable fence.
 * It accepts no input, so a caller cannot accidentally persist an auth token via
 * this API. Actual cross-process fencing requires a separate public identifier,
 * independent monotonic authority and a privacy review; none is implemented.
 */
export function createPrototypeFenceToken(): PrototypeFenceToken {
  if (arguments.length !== 0) return block('fence handle accepts no input');
  const token = Object.freeze(Object.create(null)) as PrototypeFenceToken;
  issuedFenceTokens.add(token); return token;
}

/** JSON tuple encoding avoids collisions between colon-containing scope components. */
export function prototypeJournalKey(scope: PrototypeScope): string {
  if (!scope || Object.keys(scope).length !== 2 || !Object.prototype.hasOwnProperty.call(scope, 'serverId') ||
      !Object.prototype.hasOwnProperty.call(scope, 'ownerRef')) return block('invalid scope');
  const { serverId, ownerRef } = scope;
  if (typeof serverId !== 'string' || !serverId || serverId.length > 1024 ||
      typeof ownerRef !== 'string' || !ownerRef || ownerRef.length > 1024) return block('invalid scope');
  return 'raw-material-split.journal.prototype.v2:' + JSON.stringify([serverId, ownerRef]);
}

type PrototypeJournal = Readonly<{
  key: string;
  bindOwner(): Promise<never>;
  inspect(): Promise<never>;
  prepare(expectedRevision: number, command: PrototypeCommand): Promise<never>;
  markUncertain(expectedRevision: number, requestId: string): Promise<never>;
  cancelPrepared(expectedRevision: number, requestId: string): Promise<never>;
  recordOutcome(expectedRevision: number, requestId: string, outcomeJson: string): Promise<never>;
  acknowledge(expectedRevision: number, requestId: string, observedOutcomeJson: string): Promise<never>;
}>;

/**
 * These methods block before any I/O. There is no caller-provided Boolean,
 * callback, matching envelope, or fake capability that can release the gate.
 * This makes the refusal a known no-write result rather than an uncertain commit.
 */
export function createRawSplitJournalPrototype(options: {
  store: PrototypeTransactionalStore;
  scope: PrototypeScope;
  owner: PrototypeOwner;
  observeLegacy: () => PrototypeLegacyObservation;
}): PrototypeJournal {
  const key = prototypeJournalKey(options.scope), owner = options.owner;
  if (!owner || !Number.isSafeInteger(owner.generation) || owner.generation < 1 ||
      typeof owner.isCurrent !== 'function' || !issuedFenceTokens.has(owner.token)) block('invalid public fence handle');
  return Object.freeze({
    key,
    async bindOwner() { return block('independent recovery authority unavailable'); },
    async inspect() { return block('independent recovery authority unavailable'); },
    async prepare() { return block('independent recovery authority unavailable'); },
    async markUncertain() { return block('independent recovery authority unavailable'); },
    // A prepared value alone cannot prove an older or bypassing writer never sent it.
    async cancelPrepared() { return block('dispatch provenance unavailable'); },
    async recordOutcome() { return block('outcome authority unavailable'); },
    async acknowledge() { return block('acknowledgment authority unavailable'); },
  });
}

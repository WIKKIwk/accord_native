/**
 * TEST-ONLY CONDITIONAL MODEL. This file is not application code, performs no
 * network or printer work, and is not an adapter for real native storage. Its
 * caller-provided legacy assertions and outcome fields are intentionally fake;
 * they do not establish authority, recovery provenance, or user acknowledgment.
 *
 * The guarantees below are conditional on an external exclusive, durable,
 * single-key update implementation, a valid monotonic owner fence, continuously
 * excluding ALL legacy writers, and an authoritative server-status identity.
 * None of those conditions has been established for the application. In
 * particular, two separately read legacy keys cannot provide that exclusion.
 * The production write and print hold must remain in force.
 */

export type PrototypeScope = Readonly<{ serverId: string; ownerRef: string }>;
export type PrototypeOwner = Readonly<{ generation: number; token: string; isCurrent: () => boolean }>;
export type PrototypeLegacyObservation = Readonly<{
  writers: 'stopped' | 'active' | 'unknown';
  stockKey: 'absent' | 'present' | 'unknown';
  issueKey: 'absent' | 'present' | 'unknown';
}>;
export type PrototypeCommand = Readonly<{ kind: 'stock' | 'issue'; requestId: string; json: string }>;

type Fence = { generation: number; token: string };
type Entry = { command: PrototypeCommand; phase: 'prepared' | 'uncertain' | 'completed' | 'cancelled'; outcomeJson: string | null };
export type PrototypeJournalState = Readonly<{
  version: 1;
  scope: PrototypeScope;
  revision: number;
  owner: Fence;
  active: Entry | null;
  tombstones: Entry[];
}>;

/** This is an assumed contract for tests, not a native storage implementation. */
export type PrototypeTransactionalStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, updater: (previous: string | null) => string): Promise<void>;
};

const MAX_TEXT = 64 * 1024;
const MAX_TOMBSTONES = 128;
const PREFIX = 'raw-material-split.journal.prototype.v1:';

export class PrototypeBlocked extends Error {
  constructor(readonly reason: string) { super(reason); this.name = 'PrototypeBlocked'; }
}

/** A storage error or a masked updater rejection can have an unknown outcome. */
export class PrototypeWriteUncertain extends Error {
  constructor(readonly original: unknown) { super('Journal update may have committed; inspect before any further action'); this.name = 'PrototypeWriteUncertain'; }
}

function block(reason: string): never { throw new PrototypeBlocked(reason); }
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return block('invalid object');
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value).sort(), wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) block('invalid fields');
}
function nonempty(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return block('invalid text');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return block('invalid number');
  return value;
}
function scopeValue(value: unknown): PrototypeScope {
  const object = record(value); exactKeys(object, ['serverId', 'ownerRef']);
  return { serverId: nonempty(object.serverId, 1024), ownerRef: nonempty(object.ownerRef, 1024) };
}
function sameScope(left: PrototypeScope, right: PrototypeScope): boolean {
  return left.serverId === right.serverId && left.ownerRef === right.ownerRef;
}
function fenceValue(value: unknown): Fence {
  const object = record(value); exactKeys(object, ['generation', 'token']);
  return { generation: number(object.generation), token: nonempty(object.token, 1024) };
}
function commandValue(value: unknown): PrototypeCommand {
  const object = record(value); exactKeys(object, ['kind', 'requestId', 'json']);
  if (object.kind !== 'stock' && object.kind !== 'issue') return block('invalid command kind');
  const requestId = nonempty(object.requestId, 128), json = nonempty(object.json, MAX_TEXT);
  if (!/^[A-Za-z0-9_:-]{8,128}$/.test(requestId)) return block('invalid request identity');
  let payload: Record<string, unknown>;
  try { payload = record(JSON.parse(json)); } catch { return block('invalid command JSON'); }
  const command = object.kind === 'stock' ? payload : record(payload.command);
  if (command.request_id !== requestId) return block('command identity mismatch');
  return { kind: object.kind, requestId, json };
}

/**
 * Illustrative envelope only. No deployed endpoint supplying this is known.
 * Matching fields are necessary, not proof that a server is authoritative.
 */
function outcomeValue(json: unknown, scope: PrototypeScope, command: PrototypeCommand): string {
  const text = nonempty(json, MAX_TEXT); let outcome: Record<string, unknown>;
  try { outcome = record(JSON.parse(text)); } catch { return block('invalid outcome JSON'); }
  if (outcome.server_id !== scope.serverId || outcome.owner_ref !== scope.ownerRef ||
      outcome.request_id !== command.requestId || outcome.command_kind !== command.kind ||
      (outcome.status !== 'applied' && outcome.status !== 'rejected')) block('outcome identity mismatch');
  record(outcome.response);
  return text;
}
function entryValue(value: unknown, scope: PrototypeScope): Entry {
  const object = record(value); exactKeys(object, ['command', 'phase', 'outcomeJson']);
  const command = commandValue(object.command);
  if (object.phase !== 'prepared' && object.phase !== 'uncertain' && object.phase !== 'completed' && object.phase !== 'cancelled') return block('invalid phase');
  if (object.phase === 'completed') return { command, phase: 'completed', outcomeJson: outcomeValue(object.outcomeJson, scope, command) };
  if (object.outcomeJson !== null) return block('unexpected outcome');
  return { command, phase: object.phase, outcomeJson: null };
}
function stateValue(raw: string, expectedScope: PrototypeScope): PrototypeJournalState {
  let object: Record<string, unknown>;
  try { object = record(JSON.parse(raw)); } catch { return block('invalid journal JSON'); }
  exactKeys(object, ['version', 'scope', 'revision', 'owner', 'active', 'tombstones']);
  if (object.version !== 1) return block('unsupported journal version');
  const scope = scopeValue(object.scope);
  if (!sameScope(scope, expectedScope)) return block('journal scope mismatch');
  if (!Array.isArray(object.tombstones) || object.tombstones.length > MAX_TOMBSTONES) return block('invalid tombstones');
  const tombstones = object.tombstones.map(value => entryValue(value, scope));
  if (tombstones.some(value => value.phase !== 'completed' && value.phase !== 'cancelled')) return block('invalid tombstone');
  const active = object.active === null ? null : entryValue(object.active, scope);
  if (active?.phase === 'cancelled') return block('cancelled command must be tombstoned');
  if (active !== null && tombstones.length >= MAX_TOMBSTONES) return block('journal capacity exceeded');
  const ids = [...tombstones.map(value => value.command.requestId), ...(active ? [active.command.requestId] : [])];
  if (new Set(ids).size !== ids.length) return block('duplicate request identity');
  return { version: 1, scope, revision: number(object.revision), owner: fenceValue(object.owner), active, tombstones };
}
function nextRevision(state: PrototypeJournalState): number {
  if (state.revision === Number.MAX_SAFE_INTEGER) return block('revision exhausted');
  return state.revision + 1;
}
function requireRevision(state: PrototypeJournalState, expected: number): void {
  if (state.revision !== number(expected)) block('stale revision');
}
function requireOwner(state: PrototypeJournalState, owner: Fence): void {
  if (state.owner.generation !== owner.generation || state.owner.token !== owner.token) block('stale owner');
}
function copy(state: PrototypeJournalState): PrototypeJournalState {
  return stateValue(JSON.stringify(state), state.scope);
}

/** JSON tuple encoding avoids collisions between colon-containing scope components. */
export function prototypeJournalKey(scope: PrototypeScope): string {
  const checked = scopeValue(scope);
  return PREFIX + JSON.stringify([checked.serverId, checked.ownerRef]);
}

/**
 * This experimental API never sends, retries, removes legacy keys or prints.
 * Every update error is indeterminate, including a callback rejection: callers
 * must stop and inspect, not automatically retry or infer that nothing happened.
 */
export function createRawSplitJournalPrototype(options: {
  store: PrototypeTransactionalStore;
  scope: PrototypeScope;
  owner: PrototypeOwner;
  observeLegacy: () => PrototypeLegacyObservation;
}) {
  const scope = scopeValue(options.scope);
  const owner = fenceValue({ generation: options.owner.generation, token: options.owner.token });
  const isCurrent = options.owner.isCurrent, observeLegacy = options.observeLegacy;
  const key = prototypeJournalKey(scope);
  function guard(): void {
    let current = false, legacy: PrototypeLegacyObservation | null = null;
    try { current = isCurrent() === true; legacy = observeLegacy(); } catch { /* Fail closed. */ }
    if (!current) block('owner is not current');
    if (legacy?.writers !== 'stopped' || legacy.stockKey !== 'absent' || legacy.issueKey !== 'absent') block('legacy state not excluded');
  }
  async function update(transition: (state: PrototypeJournalState | null) => PrototypeJournalState): Promise<PrototypeJournalState> {
    guard(); let written: PrototypeJournalState | null = null, callbacks = 0, rejected: PrototypeBlocked | null = null;
    try {
      await options.store.setItemAsync(key, previous => {
        try {
          guard(); callbacks++;
          if (callbacks !== 1) return block('unexpected updater invocation');
          const next = transition(previous === null ? null : stateValue(previous, scope));
          written = copy(next);
          return JSON.stringify(written);
        } catch (error) {
          if (error instanceof PrototypeBlocked) rejected = error;
          throw error;
        }
      });
      if (callbacks !== 1 || written === null) return block('updater not invoked');
      guard();
      return copy(written);
    } catch (error) {
      // The assumed updater contract invokes the callback before writing its
      // returned value. Only the same propagated rejection is known not to have
      // supplied a value. A different/masked error remains indeterminate.
      if (rejected !== null && error === rejected) throw rejected;
      throw new PrototypeWriteUncertain(error);
    }
  }
  function existing(state: PrototypeJournalState | null, revision: number): PrototypeJournalState {
    if (state === null) return block('journal not initialized');
    requireOwner(state, owner); requireRevision(state, revision); return state;
  }
  return {
    key,
    /** A higher generation is meaningful only with an external authoritative allocator. */
    async bindOwner(): Promise<PrototypeJournalState> {
      return update(state => {
        if (state === null) return { version: 1, scope, revision: 1, owner, active: null, tombstones: [] };
        if (owner.generation < state.owner.generation ||
            (owner.generation === state.owner.generation && owner.token !== state.owner.token)) return block('stale owner');
        if (owner.generation === state.owner.generation) return state;
        return { ...state, owner, revision: nextRevision(state) };
      });
    },
    /** A snapshot can become stale immediately; transitions still compare its revision. */
    async inspect(): Promise<PrototypeJournalState | null> {
      guard(); const raw = await options.store.getItemAsync(key); guard();
      if (raw === null) return null;
      const state = stateValue(raw, scope); requireOwner(state, owner); return copy(state);
    },
    async prepare(expectedRevision: number, input: PrototypeCommand): Promise<PrototypeJournalState> {
      const command = commandValue(input);
      return update(previous => {
        const state = existing(previous, expectedRevision);
        if (state.active !== null) return block('active command requires reconciliation');
        if (state.tombstones.some(entry => entry.command.requestId === command.requestId)) return block('request ID already used');
        if (state.tombstones.length >= MAX_TOMBSTONES) return block('journal capacity exhausted');
        return { ...state, revision: nextRevision(state), active: { command, phase: 'prepared', outcomeJson: null } };
      });
    },
    /** Must be durable before a hypothetical send. This method itself never sends. */
    async markUncertain(expectedRevision: number, requestId: string): Promise<PrototypeJournalState> {
      return update(previous => {
        const state = existing(previous, expectedRevision), active = state.active;
        if (!active || active.phase !== 'prepared' || active.command.requestId !== requestId) return block('prepared command mismatch');
        return { ...state, revision: nextRevision(state), active: { ...active, phase: 'uncertain' } };
      });
    },
    /** Conditional model only: safe solely if every real dispatch is mediated by markUncertain. */
    async cancelPrepared(expectedRevision: number, requestId: string): Promise<PrototypeJournalState> {
      return update(previous => {
        const state = existing(previous, expectedRevision), active = state.active;
        if (!active || active.phase !== 'prepared' || active.command.requestId !== requestId) return block('prepared command mismatch');
        return { ...state, revision: nextRevision(state), active: null, tombstones: [...state.tombstones, { ...active, phase: 'cancelled' }] };
      });
    },
    /** Caller must independently establish authority; matching the envelope is not proof. */
    async recordOutcome(expectedRevision: number, requestId: string, outcomeJson: string): Promise<PrototypeJournalState> {
      return update(previous => {
        const state = existing(previous, expectedRevision), active = state.active;
        if (!active || active.phase !== 'uncertain' || active.command.requestId !== requestId) return block('uncertain command mismatch');
        const validated = outcomeValue(outcomeJson, scope, active.command);
        return { ...state, revision: nextRevision(state), active: { ...active, phase: 'completed', outcomeJson: validated } };
      });
    },
    /** The caller must actually present this exact outcome and obtain explicit acknowledgment. */
    async acknowledge(expectedRevision: number, requestId: string, observedOutcomeJson: string): Promise<PrototypeJournalState> {
      return update(previous => {
        const state = existing(previous, expectedRevision), active = state.active;
        if (!active || active.phase !== 'completed' || active.command.requestId !== requestId || active.outcomeJson !== observedOutcomeJson) {
          return block('observed completion mismatch');
        }
        return { ...state, revision: nextRevision(state), active: null, tombstones: [...state.tombstones, active] };
      });
    },
  };
}

import { activeSessionToken, type Session } from '../auth';
import { decodeProductionMapLiveMessage } from '../productionMapLiveStream';
import { applyWorkerLegacyDelta } from '../workerLegacyState';
import { sequenceFingerprint } from '../workerDelta';
import { adminProductionMapLiveUri } from '../workerLiveUri';
import { openWorkerLiveSocket, type WorkerLiveSocket } from '../workerLiveTransport';
import { workerQueueReadAuthorizationError } from '../workerQueueReadError';
import { decodeMaterialSequenceSnapshot, materialSequenceWire } from './materialSequenceApi';
import type { MaterialSequenceSnapshot } from './materialSequenceModel';
import { materialSequenceAfterMove, readMaterialSequenceReplay } from './materialSequenceReplay';

type Obj = Record<string, any>;
function editedSequence(before: string[], edit: Obj) {
  if (!Array.isArray(before) || edit.base_len !== before.length || edit.base_hash !== sequenceFingerprint(before) ||
    !Number.isSafeInteger(edit.len) || edit.len < 0 || !Array.isArray(edit.ops)) throw Error('sequence baseline');
  const next: string[] = [];
  for (const op of edit.ops) {
    if (Array.isArray(op) && op[0] === 0 && op.length === 3 && Number.isSafeInteger(op[1]) && Number.isSafeInteger(op[2]) &&
      op[1] >= 0 && op[2] > 0 && op[1] + op[2] <= before.length) next.push(...before.slice(op[1], op[1] + op[2]));
    else if (Array.isArray(op) && op[0] === 1 && op.length === 2 && Array.isArray(op[1]) && op[1].length &&
      op[1].every((id: unknown) => typeof id === 'string' && !!id)) next.push(...op[1]);
    else throw Error('sequence operation');
    if (next.length > edit.len) throw Error('sequence overflow');
  }
  if (next.length !== edit.len || new Set(next).size !== next.length || sequenceFingerprint(next) !== edit.hash) throw Error('sequence result');
  return next;
}

/** @v2 AdminProductionMapLiveStateDelta.applyTo: normalize v2 list edits before the shared canonical v1 field merger. */
export function materialSequenceDelta(before: Obj, event: Obj, session: Session): Obj | null {
  if (event.protocol === 'state_delta_v1') return applyWorkerLegacyDelta(before, event, session);
  if (event.protocol !== 'state_delta_v2' || !event.patch || typeof event.patch !== 'object') return null;
  try {
    const patch: Obj = { ...event.patch };
    for (const key of ['sequences', 'visible_order_ids']) if (patch[key]?.edit) {
      const value = patch[key], upsert = { ...value.upsert };
      for (const [id, edit] of Object.entries(value.edit)) {
        if (Object.hasOwn(upsert, id) || value.remove?.includes(id)) throw Error('sequence conflict');
        upsert[id] = editedSequence(before[key]?.[id], edit as Obj);
      }
      patch[key] = { upsert, remove: value.remove };
    }
    if (Object.hasOwn(patch, 'map_order_edit')) {
      if (Object.hasOwn(patch, 'map_order')) return null;
      patch.map_order = editedSequence(before.maps.map((saved: Obj) => saved.map.id), patch.map_order_edit);
      delete patch.map_order_edit;
    }
    return applyWorkerLegacyDelta(before, { ...event, protocol: 'state_delta_v1', patch }, session);
  } catch { return null; }
}

/** @v2 _runWorkerLiveStream: Material's non-worker global stream, native ping/pong and bounded reconnect. */
export function subscribeMaterialSequence(session: Session, current: () => boolean,
  getSnapshot: () => MaterialSequenceSnapshot | null, apply: (value: MaterialSequenceSnapshot) => void,
  recover: () => void, onError: (error: unknown) => void, validated: () => void = () => {}) {
  let stopped = false, terminal = false, socket: WorkerLiveSocket | null = null, attempt = 0, generation = 0;
  let retry: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  const active = () => !stopped && !terminal && current();
  const replaying = new Set<string>();
  const commitMove = (wire: Obj, delta: Obj, ids: string[]) => {
    const next = decodeMaterialSequenceSnapshot({ ...wire, sequences: { ...wire.sequences, [delta.apparatus]: ids },
      sequence_versions: { ...wire.sequence_versions, [delta.apparatus]: delta.version },
      sequence_revisions: { ...wire.sequence_revisions, [delta.apparatus]: delta.revision } }, session, true);
    next.materialSequenceUnreconciled = true; apply(next);
  };
  const sequenceMove = (delta: Obj) => {
    const snapshot = getSnapshot(), wire = materialSequenceWire(snapshot) as Obj | null, apparatus = delta.apparatus?.trim();
    if (!wire || !apparatus) return;
    if (delta.epoch && delta.epoch !== snapshot?.epoch) { recover(); return; }
    const revision = wire.sequence_revisions?.[apparatus];
    if (revision != null && delta.revision <= revision) return;
    if (revision != null && delta.base_revision > revision) {
      if (replaying.has(apparatus)) return;
      replaying.add(apparatus); const baseline = snapshot, run = generation;
      void (async () => {
        try {
          if (delta.revision - (revision + 1) >= 200) return;
          const events = await readMaterialSequenceReplay(session, apparatus, revision + 1, delta.revision, active);
          if (!active() || run !== generation || getSnapshot() !== baseline) return;
          let ids = wire.sequences?.[apparatus], nextRevision = revision, version = wire.sequence_versions?.[apparatus];
          for (const event of events) {
            if (event.apparatus !== apparatus || event.epoch !== snapshot?.epoch) return;
            ids = materialSequenceAfterMove(ids, nextRevision, version, event);
            if (!ids) return;
            nextRevision = event.revision; version = event.version;
          }
          if (ids && nextRevision === delta.revision) commitMove(wire, { apparatus, revision: nextRevision, version }, ids);
        } catch { /* Source recovers missing history from the canonical snapshot. */ }
        finally { replaying.delete(apparatus); if (active() && run === generation && getSnapshot()?.epoch === snapshot?.epoch) recover(); }
      })();
      return;
    }
    const ids = materialSequenceAfterMove(wire.sequences?.[apparatus], revision, wire.sequence_versions?.[apparatus], delta);
    if (!ids) { recover(); return; }
    commitMove(wire, delta, ids);
  };
  const detach = () => { if (deadline) clearTimeout(deadline); deadline = undefined; const previous = socket; socket = null; previous?.close(); };
  const failed = (error: unknown) => {
    if (!active()) return;
    generation++; detach(); onError(error);
    if (workerQueueReadAuthorizationError(error)) { terminal = true; return; }
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5));
    retry = setTimeout(() => { retry = undefined; if (active()) connect(true); }, Math.round(delay * (0.5 + Math.random() * 0.5)));
  };
  const connect = (compact: boolean) => {
    if (!active()) return;
    const snapshot = getSnapshot(), token = activeSessionToken(session);
    if (!token) return;
    const run = ++generation;
    try {
      socket = openWorkerLiveSocket(session, adminProductionMapLiveUri(session.baseUrl, token, { delta: true,
        stateDelta: true, compactStateDelta: compact, workerScope: false,
        epoch: snapshot?.epoch ?? '', revision: snapshot?.revision ?? null, scope: snapshot?.scope ?? '' }).toString());
      const opened = socket;
      deadline = setTimeout(() => { if (run === generation) failed(new Error('First production snapshot')); }, 10_000);
      opened.onmessage = value => {
        if (!active() || run !== generation) return;
        try {
          const event: Obj = JSON.parse(String(value.data));
          if (compact && event.ok === true && (event.protocol !== 'state_delta_v2' ||
            !['state_ready', 'state_resync', 'state_delta'].includes(event.type))) {
            generation++; detach(); connect(false); return;
          }
          const decoded = decodeProductionMapLiveMessage(event, { stateDelta: true, compact }, session);
          if (deadline) clearTimeout(deadline); deadline = undefined; attempt = 0;
          if (decoded.type === 'state_ready' || decoded.type === 'state_resync') {
            if (!decoded.recovery_supported && !decoded.recovered) throw Error('Global state stream requires snapshot parity');
            const before = getSnapshot();
            if (decoded.resync || !before || before.materialSequenceUnreconciled || decoded.epoch !== before.epoch || decoded.scope !== before.scope || decoded.revision !== before.revision) recover();
            else validated();
            return;
          }
          if (decoded.type === 'state_delta') {
            const before = materialSequenceWire(getSnapshot());
            const next = before ? materialSequenceDelta(before, event, session) : null;
            if (!next) { recover(); return; }
            const snapshot = decodeMaterialSequenceSnapshot(next, session, true); snapshot.materialSequenceLiveExtras = true; apply(snapshot);
          } else if (decoded.type === 'delta') sequenceMove(decoded);
          else { const snapshot = decodeMaterialSequenceSnapshot(event, session, true); snapshot.materialSequenceLiveExtras = true; apply(snapshot); }
        } catch (error) { failed(error); }
      };
      opened.onerror = value => { if (run === generation) failed(value.error ?? new Error('Production map live connection failed')); };
      opened.onclose = () => { if (run === generation) failed(new Error('Live connection closed')); };
    } catch (error) { failed(error); }
  };
  connect(true);
  return () => { stopped = true; generation++; if (retry) clearTimeout(retry); detach(); };
}

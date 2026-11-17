import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { productionMapLiveDeltaFromJson } from '../productionMapDelta';
import { productionMapResponseError } from '../workerControlsApi';

type Obj = Record<string, any>;

/** @v2 _sequenceAfterDelta: each move is anchored against the exact sequence revision/version. */
export function materialSequenceAfterMove(ids: unknown, revision: unknown, version: unknown, delta: Obj): string[] | null {
  if (!Array.isArray(ids) || !Number.isInteger(revision) || delta.base_revision !== revision || delta.revision !== Number(revision) + 1 ||
    version !== delta.base_version || !/^[a-f0-9]{64}$/.test(delta.base_version) || !/^[a-f0-9]{64}$/.test(delta.version) || !delta.ops?.length) return null;
  const next: string[] = [...ids];
  for (const op of delta.ops) {
    const index = next.indexOf(op.id), before = op.before_id, after = op.after_id;
    if (op.type !== 'move' || index < 0 || before === op.id || after === op.id) return null;
    next.splice(index, 1);
    if (before != null && !next.includes(before) || after != null && !next.includes(after) ||
      before != null && after != null && next.indexOf(before) !== next.indexOf(after) + 1) return null;
    next.splice(before != null ? next.indexOf(before) : after != null ? next.indexOf(after) + 1 : 0, 0, op.id);
  }
  return next;
}

/** @v2 adminProductionMapReplay */
export async function readMaterialSequenceReplay(session: Session, apparatus: string, fromRev: number, toRev: number, current: () => boolean) {
  const guard = () => { if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching'); };
  guard();
  const query = new URLSearchParams({ apparatus, from_rev: String(fromRev), to_rev: String(toRev) });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/replay?${query}`, {}, guard);
  guard(); const body = await response.json(); guard();
  if (response.status !== 200) throw productionMapResponseError(response.status, body, 'production_map_replay');
  return Array.isArray(body.events) ? body.events.filter((row: unknown) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row: Obj) => productionMapLiveDeltaFromJson({ ...row, epoch: body.epoch ?? '' })) : [];
}

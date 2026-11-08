import { activeSessionToken, type Session } from '../../auth';
import { authorizedFetch, currentQueueSnapshotReadEpoch } from '../../authorizedFetch';
import { sessionReadScope } from '../../sessionReadScope';
import { productionMapResponseError } from '../../workerControlsApi';
import { appRoutes, canOpenRoute } from '../appRoutes';
import { isSynchronouslyTrue } from '../camera/synchronousGuard';
import { dartTrim, isAscii, isAsciiCanonicalApparatusId } from '../dartApparatus';
import { MobileApiException } from '../mobileApiException';
import { supplyTaskWindowFromJson, type SupplyTaskKind, type SupplyTaskWindow } from './supplyTaskModels';

type SupplyTaskRequest = { kind: SupplyTaskKind; apparatus?: string; limit?: number; search?: string };
type Pending = Map<string, Promise<SupplyTaskWindow>>;
// Sharing only within the same lifetime guard avoids one screen adopting a
// different screen's in-flight result after its own lifetime ends.
const pendingBySession = new WeakMap<Session, WeakMap<() => boolean, Pending>>();
const invalid = () => new MobileApiException({ code: 'supply_tasks_invalid', message: 'Vazifalar holatini qayta yuklang.' });

/**
 * Unwired until raw JSON integer tokens, session ABA and the live transport are
 * reviewed. The caller's guard must cover the complete account/screen lifetime.
 *
 * @v2 supplyTaskWindow
 */
export function readSupplyTaskWindow(session: Session, input: SupplyTaskRequest, isCurrent: () => boolean): Promise<SupplyTaskWindow> {
  const kind = input.kind, apparatus = input.apparatus ?? '', limit = input.limit ?? 10, search = dartTrim(input.search ?? '');
  if ((kind !== 'material' && kind !== 'qolip') || ![5, 10, 20, 50].includes(limit) ||
      (apparatus !== '' && !isAsciiCanonicalApparatusId(apparatus)) || !isAscii(search)) throw new TypeError('Invalid supply task window');
  // Non-ASCII search is withheld until Dart/Node/Hermes lowercase parity is verified.
  const normalizedSearch = search.toLowerCase();
  const scope = sessionReadScope(session), route = kind === 'material' ? appRoutes.materialTasks : appRoutes.qolipTasks;
  const guard = () => {
    const token = activeSessionToken(session);
    const allowed = () => sessionReadScope(session) === scope && canOpenRoute(session, route);
    if (!token || !allowed() || !isSynchronouslyTrue(isCurrent) || activeSessionToken(session) !== token || !allowed()) {
      throw new Error('Hisob o‘zgardi.');
    }
  };
  guard();
  const token = activeSessionToken(session)!;
  const query = new URLSearchParams({ kind, apparatus, limit: String(limit), search: normalizedSearch });
  const key = JSON.stringify([scope, token, currentQueueSnapshotReadEpoch(), query.toString()]);
  let byGuard = pendingBySession.get(session);
  if (!byGuard) { byGuard = new WeakMap(); pendingBySession.set(session, byGuard); }
  let pending = byGuard.get(isCurrent);
  if (!pending) { pending = new Map(); byGuard.set(isCurrent, pending); }
  const deliver = (promise: Promise<SupplyTaskWindow>) => promise.then(window => { guard(); return window; },
    error => { guard(); throw error; });
  const existing = pending.get(key);
  // Each invocation checks its own lifetime before receiving data or errors.
  if (existing) return deliver(existing);
  const owned = pending;
  let result: Promise<SupplyTaskWindow>;
  result = (async () => {
    const response = await authorizedFetch(session, `/v1/mobile/production-tasks/window?${query}`, {}, guard);
    guard();
    const raw = await response.text();
    guard();
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch {
      if (response.status !== 200) throw productionMapResponseError(response.status, null, 'supply_tasks_failed');
      throw invalid();
    }
    if (response.status !== 200) throw productionMapResponseError(response.status, body, 'supply_tasks_failed');
    const window = supplyTaskWindowFromJson(body);
    guard();
    if (window.kind !== kind || window.limit !== limit || window.search !== normalizedSearch) throw invalid();
    return window;
  })().finally(() => { if (owned.get(key) === result) owned.delete(key); });
  owned.set(key, result);
  return deliver(result);
}

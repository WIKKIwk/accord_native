import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { adminProductionMap } from '../productionMapReadApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { isMaterialTestSession } from './materialTestSession';
import { WorkerControlException } from '../workerControlsApi';

/** @v2 _SupplyTasksScreenState._fullOrder */
export async function readMaterialTaskDetail(session: Session, witness: SessionWitness, row: Pick<SupplyTaskRow, 'id'>, isCurrent: () => boolean, route: string = appRoutes.materialTasks) {
  const id = row.id;
  const assertCurrent = () => {
    const allowed = () => witness.session === session && !isMaterialTestSession(session) &&
      session.profile.role === 'material_taminotchi' && [appRoutes.materialTasks, appRoutes.supplySequence].some(value => value === route) && canOpenRoute(session, route) && isSessionWitnessCurrent(witness);
    if (typeof id !== 'string' || !id.trim() || !allowed() || !isSynchronouslyTrue(isCurrent) || !allowed()) {
      throw new Error('Buyurtma mavjud emas.');
    }
  };
  assertCurrent();
  const order = await adminProductionMap(session, id, assertCurrent);
  assertCurrent();
  if (order.map.id !== id) throw new WorkerControlException('order_not_available', '');
  assertCurrent();
  return order;
}

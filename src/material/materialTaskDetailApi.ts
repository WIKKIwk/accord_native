import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { adminProductionMap } from '../productionMapReadApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { isMaterialTestSession } from './materialTestSession';

/** @v2 _SupplyTasksScreenState._fullOrder */
export async function readMaterialTaskDetail(session: Session, witness: SessionWitness, row: SupplyTaskRow, isCurrent: () => boolean) {
  const id = row.id;
  const assertCurrent = () => {
    const allowed = () => witness.session === session && !isMaterialTestSession(session) &&
      session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialTasks) && isSessionWitnessCurrent(witness);
    if (typeof id !== 'string' || !id.trim() || !allowed() || !isSynchronouslyTrue(isCurrent) || !allowed()) {
      throw new Error('Buyurtma mavjud emas.');
    }
  };
  assertCurrent();
  const order = await adminProductionMap(session, id, assertCurrent);
  assertCurrent();
  if (order.map.id !== id) throw new Error('Buyurtma mavjud emas.');
  assertCurrent();
  return order;
}

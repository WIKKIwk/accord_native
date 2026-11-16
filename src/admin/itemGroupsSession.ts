import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminCreateItemGroup, adminItemGroups, adminItemGroupTree, adminMoveItemGroupParent } from './itemGroupApi';
import { itemGroupsItemsPage } from './itemGroupsItemsApi';
import { ItemGroupsController } from './itemGroupsController';

export function createItemGroupsSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, canInteract: () => boolean = () => true) {
  let retired = false; const scope = sessionReadScope(session);
  const current = () => {
    if (retired) return false;
    if (witness.session !== session || session.token === 'test-mode-token' || !isSessionWitnessCurrent(witness) ||
        !isSynchronouslyTrue(isCurrent) || sessionReadScope(session) !== scope || !canOpenRoute(session, appRoutes.adminItemGroupCreate)) retired = true;
    return !retired;
  };
  return { current, controller: new ItemGroupsController({ isCurrent: current, canInteract,
    groups: (guard, readWitness) => adminItemGroups(session, guard, readWitness),
    tree: (guard, readWitness) => adminItemGroupTree(session, guard, readWitness),
    items: (group, offset, guard, readWitness) => itemGroupsItemsPage(session, group, offset, guard, readWitness),
    create: (name, parent, group, guard) => adminCreateItemGroup(session, name, parent, group, guard),
    move: (name, parent, guard) => adminMoveItemGroupParent(session, name, parent, guard),
  }) };
}

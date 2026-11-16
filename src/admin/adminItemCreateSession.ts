import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { adminCatalogItemsPage, adminCatalogItemUoms, createAdminCatalogItem, moveAdminCatalogItems } from './adminItemCatalogApi';
import { adminItemCreateCacheNamespace } from './adminItemCreateCacheNamespace';
import { AdminItemCreateController } from './adminItemCreateController';
import { readAdminItemCreateCustomers } from './adminItemCreateCustomersApi';
import { adminItemCreateCanSelect, adminItemCreateCanUseAdminComponents } from './adminItemCreateModel';
import { adminItemCreateMemoryCache } from './adminItemCreateRuntime';
import { adminItemGroups, adminItemGroupTree } from './itemGroupApi';

type SessionProps = Pick<AdminItemCreateScreenProps, 'session' | 'witness' | 'isCurrent' | 'onOpenItem' | 'onCreateCustomer' | 'onReturnCreated' | 'initialItemGroup' | 'returnOnCreate'>;
export function createAdminItemCreateSession(props: SessionProps) {
  const { session, witness } = props, parent = createProfileSessionGuard(props.isCurrent), epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  const namespace = adminItemCreateCacheNamespace(session, witness), sales = session.profile.role === 'sales_manager'; let retired = false;
  const current = () => {
    if (retired) return false;
    const valid = () => namespace !== null && epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminItemCreate);
    try { if (!valid() || !parent() || !valid()) retired = true; return !retired; } catch { retired = true; return false; }
  };
  const needsItemDetail = !sales && adminItemCreateCanUseAdminComponents(session), needsCustomerCreate = session.capabilities.includes('party.customer.manage');
  const ready = (!needsItemDetail || typeof props.onOpenItem === 'function') && (!needsCustomerCreate || typeof props.onCreateCustomer === 'function') && (!props.returnOnCreate || typeof props.onReturnCreated === 'function');
  const controller = new AdminItemCreateController({ isCurrent: current, namespace: namespace ?? '', cache: adminItemCreateMemoryCache,
    list: { page: (query, group, limit, offset, guard, witness) => adminCatalogItemsPage(session, { query, group, limit, offset }, guard, witness),
      move: (codes, group, guard) => moveAdminCatalogItems(session, codes, group, guard), canSelect: () => adminItemCreateCanSelect(session),
      canOpenItem: () => needsItemDetail && typeof props.onOpenItem === 'function', openItem: async item => { if (!props.onOpenItem) throw new Error('Item detail destination is unavailable'); await props.onOpenItem(item); } },
    form: { sales, initialItemGroup: props.initialItemGroup ?? '', returnOnCreate: props.returnOnCreate ?? false,
      tree: (guard, witness) => adminItemGroupTree(session, guard, witness), groups: (guard, witness) => adminItemGroups(session, guard, witness),
      uoms: (guard, witness) => adminCatalogItemUoms(session, guard, witness), duplicateItems: (query, guard, witness) => adminCatalogItemsPage(session, { query, limit: 5 }, guard, witness),
      create: (input, guard) => createAdminCatalogItem(session, input, guard) },
    customers: (query, limit, offset, guard, witness) => readAdminItemCreateCustomers(session, { query, limit, offset }, guard, witness),
    createCustomer: needsCustomerCreate ? props.onCreateCustomer : undefined, onReturnCreated: props.onReturnCreated });
  return { current, controller, ready, sales, canSelect: adminItemCreateCanSelect(session), needsItemDetail, needsCustomerCreate };
}

import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { adminCustomerChildScope } from './adminCustomerChildScope';
import { AdminWorkerDetailEditorController } from './adminWorkerDetailEditorController';
import { adminWorkerDetailWarehouses } from './adminWorkerDetailAssignmentsApi';
import { adminAssignWarehouse } from './adminWarehouseAssignmentApi';
import { adminUnassignWarehouse } from './adminWarehouseSettingsApi';

/** The same source warehouse editor, with Material identity and its genuine parent reload/change callbacks. */
export function adminCustomerMaterialWarehouseSession(props: Pick<AdminCustomerMaterialWarehouseProps, 'session' | 'witness' | 'isCurrent' | 'principalRef'>,
  latest: () => AdminCustomerMaterialWarehouseProps) {
  const { session, witness, isCurrent, principalRef } = props, current = adminCustomerChildScope(session, witness, isCurrent); let serial = 0;
  const operationLocales = { add: localeController.locale, remove: localeController.locale };
  const locale = (key: string) => key.startsWith('warehouse.unassign') ? operationLocales.remove : operationLocales.add;
  const unavailable = async (): Promise<never> => { throw new Error('Material responsibilities are not part of a warehouse editor'); };
  const controller = new AdminWorkerDetailEditorController({ mode: 'warehouse', isCurrent: current, nextId: () => ++serial, name: () => latest().displayName,
    assignedWarehouses: () => latest().assignedWarehouses, assignedMaterials: () => [], warehouses: (guard, readWitness) => adminWorkerDetailWarehouses(session, guard, readWitness),
    assignWarehouse: (warehouse, displayName, guard) => adminAssignWarehouse(session, { warehouse, principal_role: 'material_taminotchi', principal_ref: principalRef, display_name: displayName }, guard),
    unassignWarehouse: (warehouse, guard) => adminUnassignWarehouse(session, { warehouse, principal_role: 'material_taminotchi', principal_ref: principalRef }, guard),
    reloadWarehouses: async (guard, readWitness) => { guard(); if (!readWitness()) throw new Error('Material warehouse read changed'); const values = await latest().reloadAssignedWarehouses(); guard(); return values; },
    changedWarehouses: values => latest().onChanged(values), materials: unavailable, assignMaterial: unavailable, unassignMaterial: unavailable, reloadMaterials: unavailable,
    changedMaterials: () => { throw new Error('Material responsibilities are not part of a warehouse editor'); },
    text: (key, values) => adminText(key, locale(key), values), notice: (key, values) => latest().onNotice(adminText(key, locale(key), values && Object.fromEntries(Object.entries(values).map(([name, value]) => [name, name === 'error' ? String(value) : value])))),
    rawNotice: () => { throw new Error('Raw material notices are not part of a warehouse editor'); } });
  return { current, controller, beginAdd: () => { operationLocales.add = localeController.locale; }, beginRemove: () => { operationLocales.remove = localeController.locale; } };
}

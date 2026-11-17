import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { qolipReturnCheckout } from './qolipCheckoutApi';
import { createQolipCheckoutView } from './qolipCheckoutViewRuntime';
import { QolipCheckoutReturns } from './qolipCheckoutReturns';
import { qolipErrorMessage } from './qolipErrorMessage';
import { useQolipRole } from './QolipRoleContext';
import { useQolipCellPickerDialog } from './useQolipCellPickerDialog';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
export function useQolipCheckouts() {
  const role = useQolipRole(), pick = useQolipCellPickerDialog();
  const owner = useMemo(() => createQolipCheckoutView(role.session, role.boundary, { returningIds: new Set(), bulkReturning: false }), [role.session, role.boundary]);
  const actions = useMemo(() => new QolipCheckoutReturns({ current: role.isCurrent,
    pick: entry => pick(productionText('qolip.checkouts.return_to_mold', localeController.locale, { qolip: entry.qolip_code })),
    send: (entry, cell) => qolipReturnCheckout(role.session, entry.id, { rowLetter: cell[0], columnNumber: Number(cell.slice(1)) }, role.isCurrent),
    reload: () => owner.reload(), selected: () => owner.bulkChoice(), replaceSelected: ids => owner.replaceSelected(ids),
    message: (key, values) => role.notice(productionText('qolip.' + key, localeController.locale, values)),
    failure: error => role.notice(qolipErrorMessage(error, localeController.locale, productionText('qolip.checkouts.return_failed', localeController.locale))),
  }), [owner, role, pick]);
  const locks = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.activate(), [owner]);
  useLayoutEffect(() => owner.updateLocks(locks), [owner, locks]);
  return { snapshot, returns: actions, reload: () => owner.reload() };
}

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { qolipBlocksData } from './qolipBlocksApi';
import { qolipLocations, qolipMoveLocation } from './qolipLocationsApi';
import { qolipErrorMessage } from './qolipErrorMessage';
import { QolipLocationTransferState } from './qolipLocationTransferState';
import { useQolipRole } from './QolipRoleContext';
import { useQolipCellPickerDialog } from './useQolipCellPickerDialog';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useQolipText } from './useQolipText';
export function useQolipLocationTransfer() {
  const role = useQolipRole(), { text } = useQolipText(), picker = useQolipCellPickerDialog();
  const controller = useMemo(() => new QolipLocationTransferState({ current: role.isCurrent,
    blocks: () => qolipBlocksData(role.session, role.isCurrent), locations: block => qolipLocations(role.session, block, role.isCurrent),
    move: input => qolipMoveLocation(role.session, input, role.isCurrent),
    message: (key, values) => role.notice(productionText('qolip.' + key, localeController.locale, values)),
    failure: error => role.notice(qolipErrorMessage(error, localeController.locale, productionText('qolip.transfer.failed', localeController.locale))),
  }), [role]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void Promise.resolve().then(() => controller.reload()); }, [controller]);
  const pickCell = async () => { const source = state.source, target = controller.block(state.targetBlock); if (!source || !target) return;
    const same = source.block.trim().toLowerCase() === target.name.trim().toLowerCase();
    const value = await picker(text('home.select_cell', { block: target.name }), same ? source.location_label : null);
    if (value && role.isCurrent()) controller.setCell(value);
  };
  return { ...state, controller, pickCell, targetBlocks: controller.targetBlocks, text };
}

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useIsFocused } from 'expo-router';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminWarehouseSettingsProps } from './AdminWarehouseSettingsTypes';
import { adminWarehouseSettingsSession } from './adminWarehouseSettingsSession';
import { adminWarehouseSettingsDialogText } from './adminWarehouseSettingsPresentation';
import type { AdminUserListEntry } from './adminUsersModel';
import type { WarehouseAssignment } from '../shared/catalogApi';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminWarehouseSettings(props: AdminWarehouseSettingsProps) {
  const { session, witness, isCurrent, onChanged, onDeleted, summaries, warehouse, onFilterToggle, onWarehouseChanged } = props;
  const owner = useMemo(() => adminWarehouseSettingsSession(session, witness, isCurrent, { onChanged, onDeleted }), [session, witness, isCurrent, onChanged, onDeleted]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const focused = useIsFocused(), focus = useRef(focused), interaction = useRef(props.canInteract), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { interaction.current = props.canInteract; }, [props.canInteract]);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useLayoutEffect(() => { controller.setSelection(warehouse, summaries); }, [controller, warehouse, summaries]);
  useEffect(() => { const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate(); return unsubscribe; }, [controller, owner]);
  useEffect(() => { if (!state.notice) return; const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer); }, [controller, state.notice]);
  const generation = controller.interactionGeneration, internal = () => focus.current && generation === controller.interactionGeneration && controller.isCurrent();
  const interactive = () => internal() && (!interaction.current || isSynchronouslyTrue(interaction.current)) && internal();
  const notice = state.notice ? 'message' in state.notice ? state.notice.message : adminText(state.notice.key, locale, state.notice.values) : null;
  return { state, summary: controller.summary(), current: focused && owner.current() && state.phase === 'content', locale,
    a: (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), t: (key: string) => localizedGetter(key, locale), notice,
    dialogText: state.dialog ? adminWarehouseSettingsDialogText(state.dialog, locale) : null, users: controller.visibleUsers(),
    toggleFilter: () => { if (interactive()) onFilterToggle(); },
    selectWarehouse: (name: string) => { if (interactive() && controller.getSnapshot().summaries.some(row => row.warehouse === name)) onWarehouseChanged(name); },
    assign: () => { if (interactive()) void controller.requestAssign(); },
    search: (id: number, query: string) => { if (interactive()) controller.searchPicker(id, query); },
    select: (id: number, user: AdminUserListEntry) => { if (interactive()) void controller.selectUser(id, user); },
    dismissPicker: (id: number) => { if (interactive()) controller.dismissPicker(id); },
    unassign: (assignment: WarehouseAssignment) => { if (interactive()) controller.requestUnassign(assignment); },
    deleteWarehouse: () => { if (interactive()) controller.requestDelete(); },
    confirm: (id: number) => { if (interactive()) void controller.confirmDialog(id); },
    dismiss: (id: number) => { if (interactive()) controller.dismissDialog(id); },
  };
}

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useIsFocused } from 'expo-router';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminWarehouseCreateSession } from './adminWarehouseCreateSession';
import type { AdminWarehouseCreateProps } from './AdminWarehouseCreateTypes';
import type { AdminUserListEntry } from './adminUsersModel';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminWarehouseCreate({ session, witness, isCurrent, onSaved, onClose }: AdminWarehouseCreateProps) {
  const owner = useMemo(() => adminWarehouseCreateSession(session, witness, isCurrent, { onSaved, onClose }), [session, witness, isCurrent, onSaved, onClose]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useEffect(() => {
    controller.start();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate();
    return () => { unsubscribe(); controller.dispose(); };
  }, [owner, controller]);
  useEffect(() => {
    if (!state.notice) return;
    const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const generation = controller.interactionGeneration;
  const interactive = () => focus.current && generation === controller.interactionGeneration && controller.isCurrent();
  return { controller: {
    changeName: (value: string) => { if (interactive()) controller.changeName(value); },
    openPicker: async () => { if (interactive()) await controller.openPicker(); },
    searchPicker: (id: number, query: string) => { if (interactive()) controller.searchPicker(id, query); },
    selectUser: (id: number, user: AdminUserListEntry) => { if (interactive()) controller.selectUser(id, user); },
    dismissPicker: (id: number) => { if (interactive()) controller.dismissPicker(id); },
    closeButton: () => { if (interactive()) controller.closeButton(); },
    dismissDialog: () => { if (interactive()) controller.dismissDialog(); },
  }, state, current: focused && owner.current() && state.phase === 'content', users: controller.visibleUsers(),
    a: (key: string) => adminText(key, locale), t: (key: string) => localizedGetter(key, locale),
    save: () => { if (interactive()) void controller.save().catch(() => { /* Source adds no create/assignment failure message. */ }); } };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminCustomerApparatusProps } from './AdminCustomerDetailScreenTypes';
import { adminCustomerApparatusSession } from './adminCustomerApparatusSession';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminCustomerApparatus(props: AdminCustomerApparatusProps) {
  const { session, witness, isCurrent, customerRef, materialTaminotchi, onChanged } = props;
  const owner = useMemo(() => adminCustomerApparatusSession({ session, witness, isCurrent, customerRef, materialTaminotchi, onChanged }), [session, witness, isCurrent, customerRef, materialTaminotchi, onChanged]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const mounted = useRef(false), latest = useRef(props), sent = useRef<unknown>(null);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  useLayoutEffect(() => { mounted.current = true; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe; }, [owner, controller]);
  const generation = controller.interactionGeneration, current = useCallback(() => mounted.current && owner.current() && controller.isCurrent(generation), [owner, controller, generation]);
  const interactive = () => current() && isSynchronouslyTrue(latest.current.isInteractive), a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  useEffect(() => { if (!state.notice || sent.current === state.notice || !current()) return; sent.current = state.notice;
    latest.current.onNotice(adminText(state.notice.key, localeController.locale, state.notice.error === undefined ? undefined : { error: String(state.notice.error) }));
  }, [state.notice, current]);
  const sheetCurrent = (id: number) => current() && controller.getSnapshot().sheet?.id === id;
  const sheetInteractive = (id: number) => interactive() && sheetCurrent(id) && !controller.getSnapshot().sheet?.closing;
  return { state, locale, a, material: materialTaminotchi, generation, current, interactive, visible: controller.visible(), sheetCurrent,
    retry: () => { if (interactive() && controller.getSnapshot().error != null) void controller.load(); },
    toggle: (id: string, checked: boolean, sheetId?: number) => { if (sheetId === undefined ? interactive() && !controller.getSnapshot().sheet : sheetInteractive(sheetId)) controller.toggle(id, checked, sheetId); },
    save: () => { if (interactive() && !controller.getSnapshot().sheet) void controller.save(); },
    openSheet: () => { if (interactive()) controller.openSheet(); },
    saveSheet: (id: number) => { if (sheetInteractive(id)) void controller.save(id); },
    closeSheet: (id: number) => { if (sheetInteractive(id) && !controller.getSnapshot().sheet?.saving) controller.dismissSheet(id); },
    nativeDismiss: (id: number) => { if (sheetCurrent(id)) controller.dismissSheet(id); },
  };
}
export type AdminCustomerApparatusModel = ReturnType<typeof useAdminCustomerApparatus>;

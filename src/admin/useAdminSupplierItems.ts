import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminSupplierItemsScreenProps } from './AdminSupplierItemsScreenTypes';
import type { AdminSupplierItemsPrompt } from './adminSupplierItemsController';
import { createAdminSupplierItemsSession } from './adminSupplierItemsSession';
import type { SupplierItem } from '../shared/catalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), localeSnapshot = () => localeController.locale;
export function useAdminSupplierItems(props: AdminSupplierItemsScreenProps) {
  const { session, witness, isCurrent, supplierRef, mode, onBack } = props;
  const owner = useMemo(() => createAdminSupplierItemsSession(session, witness, isCurrent, supplierRef, mode), [session, witness, isCurrent, supplierRef, mode]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot), focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false), leaving = useRef(false);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; leaving.current = false; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe; }, [owner, controller]);
  const generation = controller.interactionGeneration;
  const current = useCallback(() => mounted.current && !leaving.current && owner.current() && controller.isCurrent(generation), [owner, controller, generation]);
  const hostInteractive = props.canInteract;
  const interactive = () => focus.current && current() && (hostInteractive === undefined || isSynchronouslyTrue(hostInteractive)) && current();
  const back = useCallback(() => {
    if (!focus.current || !current() || hostInteractive !== undefined && !isSynchronouslyTrue(hostInteractive) || !current()) return false;
    const prompt = controller.getSnapshot().prompt;
    if (prompt) controller.dismiss(prompt);
    else { leaving.current = true; try { onBack(); } catch (error) { leaving.current = false; throw error; } }
    return true;
  }, [controller, current, onBack, hostInteractive]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return; const subscription = BackHandler.addEventListener('hardwareBackPress', back); return () => subscription.remove();
  }, [back]));
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const promptCurrent = (prompt: AdminSupplierItemsPrompt) => current() && controller.getSnapshot().prompt === prompt;
  return { state, current, interactive, generation, mode, a, back,
    title: a(mode === 'add' ? 'supplier_items.add_title' : 'supplier_items.view_title'),
    empty: a(mode === 'add' ? 'supplier_items.empty_available' : 'supplier_items.empty_assigned'),
    promptCurrent, request: (item: SupplierItem) => { if (interactive()) controller.request(item); },
    dismiss: (prompt: AdminSupplierItemsPrompt) => { if (promptCurrent(prompt)) controller.dismiss(prompt); },
    confirm: (prompt: AdminSupplierItemsPrompt) => { if (promptCurrent(prompt)) void controller.confirm(prompt).catch(() => {}); },
  };
}
export type AdminSupplierItemsScreenModel = ReturnType<typeof useAdminSupplierItems>;
export function useAdminSupplierItemsConfirmation(model: AdminSupplierItemsScreenModel) {
  const prompt = model.state.prompt!, [decision, setDecision] = useState<boolean | null>(null), ticket = useRef({ active: false, chosen: false, sent: false });
  useLayoutEffect(() => { const current = ticket.current; current.active = true; return () => { current.active = false; }; }, []);
  useEffect(() => {
    if (decision === null || !ticket.current.active || ticket.current.sent) return; ticket.current.sent = true;
    if (!model.promptCurrent(prompt)) return; if (decision) model.confirm(prompt); else model.dismiss(prompt);
  }, [model, prompt, decision]);
  return { visible: decision === null, choose: (value: boolean) => {
    if (!ticket.current.active || ticket.current.chosen || !model.interactive() || !model.promptCurrent(prompt)) return;
    ticket.current.chosen = true; setDecision(value);
  } };
}

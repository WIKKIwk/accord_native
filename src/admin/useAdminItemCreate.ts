import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { useAdminOwnedBack } from './AdminOwnedBackContext';
import { createAdminItemCreateSession } from './adminItemCreateSession';
import type { AdminItemCreateNotice } from './adminItemCreateModel';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminItemCreate(props: AdminItemCreateScreenProps) {
  const { session, witness, isCurrent, onOpenItem, onCreateCustomer, onReturnCreated, initialItemGroup, returnOnCreate, onBack } = props;
  const owner = useMemo(() => createAdminItemCreateSession({ session, witness, isCurrent, onOpenItem, onCreateCustomer, onReturnCreated, initialItemGroup, returnOnCreate }), [session, witness, isCurrent, onOpenItem, onCreateCustomer, onReturnCreated, initialItemGroup, returnOnCreate]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false), [searchFocused, setSearchFocused] = useState(false);
  const interaction = useMemo(() => props.canInteract === undefined ? null : createProfileSessionGuard(props.canInteract), [props.canInteract]), committedInteraction = useRef(interaction);
  useLayoutEffect(() => { committedInteraction.current = interaction; return () => { if (committedInteraction.current === interaction) committedInteraction.current = null; }; }, [interaction]);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; if (owner.ready) controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller, owner.ready]);
  useEffect(() => { const check = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(check); check(); return unsubscribe; }, [owner, controller]);
  useEffect(() => {
    if (!props.openCreateDialog || !owner.ready) return; const generation = controller.getSnapshot().generation; let pending = true;
    const frame = requestAnimationFrame(() => { if (pending && mounted.current && controller.isCurrent(generation)) controller.openDialog(); });
    return () => { pending = false; cancelAnimationFrame(frame); };
  }, [props.openCreateDialog, controller, owner.ready]);
  const generation = state.generation, current = useCallback(() => mounted.current && controller.isCurrent(generation), [controller, generation]);
  const nativeCurrent = useCallback(() => {
    if (!focus.current || !current() || committedInteraction.current !== interaction) return false;
    if (interaction !== null && !interaction()) return false;
    return focus.current && current() && committedInteraction.current === interaction;
  }, [current, interaction]);
  const interactive = () => nativeCurrent() && !controller.getSnapshot().picker && !controller.getSnapshot().closingDialog && !controller.form.getSnapshot().dialog;
  const dialog = state.form.dialog, picker = state.picker, prompt = state.list.prompt;
  const dialogCurrent = () => nativeCurrent() && dialog !== null && controller.form.dialogCurrent(dialog) && !controller.getSnapshot().picker;
  const pickerCurrent = () => nativeCurrent() && picker !== null && controller.getSnapshot().picker === picker && picker.controller.isCurrent();
  const back = useCallback(() => {
    if (!nativeCurrent()) return; const current = controller.getSnapshot();
    if (current.closingDialog) return;
    if (current.picker) current.picker.controller.dismiss();
    else if (current.form.dialog) controller.closeDialog(current.form.dialog, true);
    else if (current.list.prompt) controller.list.chooseMove(current.list.prompt, false);
    else onBack();
  }, [nativeCurrent, controller, onBack]);
  useAdminOwnedBack(back);
  useFocusEffect(useCallback(() => { if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!nativeCurrent()) return false; back(); return true; }); return () => subscription.remove();
  }, [nativeCurrent, back]));
  const a = useCallback((key: string, values?: Record<string, unknown>) => adminText(key, locale, values), [locale]), t = (key: string) => localizedGetter(key, locale);
  const noticeText = (notice: AdminItemCreateNotice | null) => notice?.literal ?? (notice?.getter ? t(notice.getter) : notice?.key ? a(notice.key, notice.values) : null);
  return { state, owner, locale, a, t, current, nativeCurrent, interactive, focused, searchFocused, profileVisible: !searchFocused,
    formNotice: noticeText(state.form.notice), listNotice: noticeText(state.list.notice), pickerNotice: noticeText(state.pickerState?.notice ?? null),
    back, search: (value: string) => { if (interactive()) controller.list.changeSearch(value); }, searchFocus: (value: boolean) => { if (value ? nativeCurrent() : current()) setSearchFocused(value); },
    reload: () => { if (interactive()) void controller.list.reload(); }, loadMore: () => { if (interactive()) void controller.list.loadMore(); }, scroll: (extentAfter: number) => { if (interactive()) controller.list.scroll(extentAfter); },
    toggleGroup: () => { if (interactive()) controller.list.toggleGroup(); }, group: (value: string) => { if (interactive()) controller.list.changeGroup(value); },
    clearSelection: () => { if (interactive()) controller.list.clearSelection(); },
    toggleItem: (item: Parameters<typeof controller.list.toggleItem>[0]) => { if (interactive() && state.list.items.includes(item) && controller.list.getSnapshot().items.includes(item)) controller.list.toggleItem(item); },
    openItem: (item: Parameters<typeof controller.list.openItem>[0]) => { if (interactive() && state.list.items.includes(item) && controller.list.getSnapshot().items.includes(item)) void controller.list.openItem(item); },
    requestMove: () => { if (interactive()) controller.list.requestMove(); },
    chooseMove: (confirmed: boolean) => nativeCurrent() && prompt ? controller.list.chooseMove(prompt, confirmed) : null,
    openDialog: () => { if (interactive()) { Keyboard.dismiss(); controller.openDialog(); } },
    changeName: (value: string) => { if (dialogCurrent()) controller.form.changeField(dialog!, 'name', value); }, changeCode: (value: string) => { if (dialogCurrent()) controller.form.changeField(dialog!, 'code', value); },
    closeDialog: (outsideOrBack = false) => { if (dialogCurrent()) controller.closeDialog(dialog!, outsideOrBack); }, save: () => { if (dialogCurrent() && !dialog!.savingView) void controller.save(dialog!); },
    openPicker: (kind: 'group' | 'uom' | 'customer') => { if (dialogCurrent()) { Keyboard.dismiss(); controller.openPicker(kind, dialog!); } },
    clearCustomer: () => { if (dialogCurrent() && !dialog!.savingView) controller.form.setCustomer(dialog!.id, null); },
    completeDialog: (id: number) => { if (current()) controller.completeDialog(id); },
    pickerSearch: (value: string) => { if (pickerCurrent()) picker!.controller.search(value); }, pickerReload: () => { if (pickerCurrent()) void picker!.controller.reload(); },
    pickerScroll: (extentAfter: number) => { if (pickerCurrent()) picker!.controller.scroll(extentAfter); },
    selectPickerString: (item: string) => { if (pickerCurrent() && picker!.kind !== 'customer') picker!.controller.select(item); },
    selectCustomer: (item: Parameters<typeof controller.form.setCustomer>[1]) => { if (pickerCurrent() && picker!.kind === 'customer' && item !== null) picker!.controller.select(item); },
    createCustomer: (allowEmptyQuery: boolean) => { if (pickerCurrent() && picker!.kind === 'customer' && (allowEmptyQuery || dartTrim(picker!.controller.getSnapshot().query))) void picker!.controller.create(); },
    dismissPicker: () => { if (pickerCurrent()) picker!.controller.dismiss(); },
    completePicker: () => { if (current() && picker !== null && controller.getSnapshot().picker === picker) picker.controller.completeClose(); },
  };
}
export type AdminItemCreateScreenModel = ReturnType<typeof useAdminItemCreate>;

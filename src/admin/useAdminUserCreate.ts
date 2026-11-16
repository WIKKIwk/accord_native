import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminUserCreateScreenProps } from './AdminUserCreateScreenTypes';
import { useAdminOwnedBack } from './AdminOwnedBackContext';
import { adminUserCreateChoiceLabel, adminUserCreateChoiceSubtitle, adminUserCreateCustomerError, adminUserCreateError, adminUserCreateIsMaterial, adminUserCreateVisibleChoices } from './adminUserCreateModel';
import { createAdminUserCreateSession } from './adminUserCreateSession';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminUserCreate(props: AdminUserCreateScreenProps) {
  const { session, witness, isCurrent, mode, onBack } = props, onCreated = props.mode === 'customer' ? props.onCreated : null, initialName = props.mode === 'customer' ? props.initialName ?? '' : '';
  const returned = useRef(onCreated), mounted = useRef(false);
  useLayoutEffect(() => { returned.current = onCreated; return () => { returned.current = null; }; }, [onCreated]);
  const deliverCustomer = useCallback((customer: Parameters<NonNullable<typeof onCreated>>[0]) => { if (mounted.current) returned.current?.(customer); }, []);
  // The constructor stores this callback; only an acknowledged asynchronous create invokes it.
  // eslint-disable-next-line react-hooks/refs
  const owner = useMemo(() => createAdminUserCreateSession({ session, witness, isCurrent, mode, initialName }, deliverCustomer), [session, witness, isCurrent, mode, initialName, deliverCustomer]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const focused = useIsFocused(), focus = useRef(focused), interaction = useMemo(() => props.canInteract === undefined ? null : createProfileSessionGuard(props.canInteract), [props.canInteract]), committedInteraction = useRef(interaction);
  useLayoutEffect(() => { committedInteraction.current = interaction; return () => { if (committedInteraction.current === interaction) committedInteraction.current = null; }; }, [interaction]);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useEffect(() => { const check = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(check); check(); return unsubscribe; }, [owner, controller]);
  useEffect(() => { if (!state.notice) return; const id = state.notice.id, timer = setTimeout(() => controller.dismissNotice(id), 5000); return () => clearTimeout(timer); }, [state.notice, controller]);
  const generation = controller.generation, current = useCallback(() => mounted.current && controller.isCurrent(generation), [controller, generation]);
  const nativeCurrent = useCallback(() => {
    if (!focus.current || !current() || committedInteraction.current !== interaction) return false;
    if (interaction !== null && !interaction()) return false;
    return focus.current && current() && committedInteraction.current === interaction;
  }, [current, interaction]);
  const interactive = useCallback(() => nativeCurrent() && !controller.getSnapshot().picker && !controller.getSnapshot().issuedCode, [nativeCurrent, controller]);
  // The original page can be behind Profile when an accepted await opens a root modal.
  // Its exact top overlay owns native events independently of the page's focus gate.
  const overlayCurrent = useCallback((kind: 'picker' | 'code', id: number) => {
    if (!current()) return false; const value = controller.getSnapshot();
    const ticket = kind === 'code' ? value.issuedCode : value.issuedCode ? null : value.picker;
    return ticket?.id === id && !ticket.closing && current() && controller.getSnapshot() === value;
  }, [current, controller]);
  const a = useCallback((key: string, values?: Record<string, unknown>) => adminText(key, locale, values), [locale]), t = (key: string) => localizedGetter(key, locale);
  const choice = state.choice, role = choice?.role, formId = state.formId;
  const pickerRows = useMemo(() => adminUserCreateVisibleChoices(state.choices ?? [], state.picker?.query ?? '', a), [state.choices, state.picker?.query, a]);
  const notice = state.notice ? state.notice.customerFailure ? adminUserCreateCustomerError(state.notice.error, state.notice.name ?? '', a) : state.notice.key === 'user.create_failed' && state.notice.error ? adminUserCreateError(state.notice.error, a) : a(state.notice.key!, { name: state.notice.name ?? '' }) : null;
  const back = useCallback(() => {
    if (!nativeCurrent()) return; const value = controller.getSnapshot();
    if (value.issuedCode) controller.dismissCode(value.issuedCode.id); else if (value.picker) controller.dismissPicker(value.picker.id); else onBack();
  }, [controller, nativeCurrent, onBack]);
  useAdminOwnedBack(back);
  useFocusEffect(useCallback(() => { if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!nativeCurrent()) return false; back(); return true; }); return () => subscription.remove();
  }, [nativeCurrent, back]));
  return { state, owner, controller, a, t, locale, focused, current, nativeCurrent, interactive, overlayCurrent, back, notice, formId,
    fields: controller.currentFields, label: choice ? adminUserCreateChoiceLabel(choice, a) : a('user.role_choose'), subtitle: choice ? adminUserCreateChoiceSubtitle(choice, a) : a('user.role_choose_message'), pickerRows,
    customerOnly: owner.options.customerOnly, footer: props.mode === 'general' ? props.footer : null, copyLabel: locale === 'uz' ? 'Nusxa olish' : a('action.copy'),
    custom: choice?.kind === 'custom' || choice?.kind === 'material', apparatusVisible: (choice?.kind === 'custom' || choice?.kind === 'material') && role?.id === 'aparatchi',
    material: !!role && adminUserCreateIsMaterial(role), saveEnabled: !state.saving && (!(role && adminUserCreateIsMaterial(role)) || state.selectedGroups.length > 0),
    codeCopyEnabled: !!dartTrim(state.code), regenerateEnabled: !state.regenerating && state.seconds <= 0,
    rolePicker: () => { if (interactive()) { Keyboard.dismiss(); void controller.openRoles(interactive); } },
    changeName: (value: string) => { if (interactive()) controller.change(formId, 'name', value); }, changePhone: (value: string) => { if (interactive()) controller.change(formId, 'phone', value); },
    save: () => { if (interactive()) void controller.save(formId); }, regenerate: () => { if (interactive()) void controller.regenerate(formId); }, copy: () => { if (interactive() && controller.getSnapshot().formId === formId) void controller.copyCode(); },
    reload: () => { if (interactive() && state.phase === 'error') void controller.reloadWerka(formId); },
    groupPicker: () => { if (interactive()) { Keyboard.dismiss(); void controller.openGroups(formId, interactive); } },
    selectApparatus: (id: string, selected: boolean) => { if (interactive()) controller.selectApparatus(formId, id, selected); },
    pickerSearch: (id: number, query: string) => { if (overlayCurrent('picker', id)) controller.pickerSearch(id, query); }, chooseRole: (id: number, value: Parameters<typeof controller.chooseRole>[1]) => { if (overlayCurrent('picker', id)) controller.chooseRole(id, value); },
    toggleGroup: (id: number, group: string, value: boolean) => { if (overlayCurrent('picker', id)) controller.toggleGroup(id, group, value); }, confirmGroups: (id: number) => { if (overlayCurrent('picker', id)) controller.confirmGroups(id); },
    dismissPicker: (id: number) => { if (overlayCurrent('picker', id)) controller.dismissPicker(id); }, completePicker: (id: number) => { if (current()) controller.completePicker(id); },
    dismissCode: (id: number) => { if (overlayCurrent('code', id)) controller.dismissCode(id); }, completeCode: (id: number) => { if (current()) controller.completeCode(id); },
    copyIssued: (id: number) => { if (overlayCurrent('code', id)) void controller.copyCode(id); },
  };
}
export type AdminUserCreateScreenModel = ReturnType<typeof useAdminUserCreate>;

import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminCustomerDetailScreenProps, AdminCustomerMaterialWarehouseProps, AdminCustomerPhoneModel } from './AdminCustomerDetailScreenTypes';
import type { AdminCustomerDetailPrompt } from './adminCustomerDetailController';
import { adminCustomerOperationError, type AdminCustomerDetail } from './adminCustomerDetailModel';
import { AdminCustomerDetailPresentation } from './adminCustomerDetailPresentation';
import { createAdminCustomerDetailSession } from './adminCustomerDetailSession';
import { adminUserRoleLabel } from './adminUsersModel';
import { adminWerkaInitials } from './adminWerkaPresentation';
import { dartTrim } from './dartJsonString';
import type { SupplierItem } from '../shared/catalogApi';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminCustomerDetail(props: AdminCustomerDetailScreenProps) {
  const { session, witness, isCurrent, customerRef, entry = null, readOnly = false, onBack } = props;
  const focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false), leaving = useRef(false);
  const owner = useMemo(() => createAdminCustomerDetailSession(session, witness, isCurrent, customerRef, entry, readOnly), [session, witness, isCurrent, customerRef, entry, readOnly]);
  const { controller, mode } = owner;
  // The constructor stores these callbacks. Only accepted events and async completions invoke them.
  // eslint-disable-next-line react-hooks/refs
  const presentation = useMemo(() => new AdminCustomerDetailPresentation({ controller, interactive: () => focus.current && !leaving.current,
    onRemoved: () => { if (!leaving.current && owner.current()) { leaving.current = true; try { onBack(true); } catch (error) { leaving.current = false; throw error; } } },
  }), [controller, owner, onBack]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const overlays = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; leaving.current = false; controller.start(); presentation.activate();
    return () => { mounted.current = false; presentation.detach(); controller.dispose(); }; }, [controller, presentation]);
  useEffect(() => {
    const retire = () => { if (!owner.current()) { presentation.detach(); controller.invalidate(); } };
    const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe;
  }, [owner, controller, presentation]);
  useEffect(() => { if (!state.notice) return; const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer); }, [controller, state.notice]);
  const generation = controller.interactionGeneration, overlayGeneration = presentation.interactionGeneration;
  const current = useCallback(() => mounted.current && owner.current() && controller.isCurrent(generation), [owner, controller, generation]);
  const interactive = () => current() && presentation.parentInteractive(overlayGeneration);
  const controlsCurrent = () => interactive() && mode.management && controller.getSnapshot().expanded;
  const back = useCallback(() => {
    if (!focus.current || leaving.current || !current()) return false;
    if (controller.getSnapshot().removed) return true;
    if (presentation.back(overlayGeneration)) return true;
    leaving.current = true;
    try { onBack(controller.getSnapshot().changed); } catch (error) { leaving.current = false; throw error; }
    return true;
  }, [current, controller, presentation, overlayGeneration, onBack]);
  useFocusEffect(useCallback(() => { if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', back); return () => subscription.remove(); }, [back]));
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const sourceTitle = props.title ?? (entry ? adminUserRoleLabel(entry) : mode.material ? 'Material taminotchisi' : 'Customer');
  const sourceSubtitle = props.profileSubtitle ?? (mode.material ? 'Material ta’minotchisi profili' : 'Haridor profili');
  const sourceEmptyName = props.emptyName ?? (mode.material ? 'Material taminotchisi' : 'Customer');
  const sourceNameless = props.namelessLabel ?? (mode.material ? 'Nomsiz material ta’minotchisi' : 'Nomsiz haridor');
  const title = sourceTitle === 'Profil' ? a('profile.title') : sourceTitle;
  const subtitle = sourceSubtitle === 'Haridor profili' ? a('detail.customer_profile') : sourceSubtitle;
  const nameless = sourceNameless === 'Nomsiz haridor' ? a('detail.nameless_customer') : sourceNameless;
  const detail: AdminCustomerDetail = state.detail ?? Object.freeze({ ref: customerRef,
    name: state.loading ? a('detail.loading') : sourceEmptyName === 'Customer' ? a('detail.customer') : sourceEmptyName,
    phone: state.loading ? a('detail.loading') : a('profile.entered'), avatar_url: '',
    code: state.loading ? a('detail.loading') : a('profile.not_generated'), code_locked: false, code_retry_after_sec: state.seconds,
    assigned_items: Object.freeze([]), assigned_item_groups: Object.freeze([]), assigned_warehouses: Object.freeze([]) });
  const displayName = dartTrim(detail.name) ? detail.name : nameless, initials = dartTrim(detail.name) ? adminWerkaInitials(detail.name) : 'H';
  const status = a(state.loading ? 'detail.loading' : state.loadError != null ? 'detail.error' : !state.detail ? 'detail.empty' : 'detail.ready');
  const promptText = state.prompt ? state.prompt.kind === 'customer' ? { title: a('detail.customer_remove_title'), body: a('detail.customer_remove_message'),
    cancel: a('action.cancel'), confirm: a('detail.customer_remove'), destructive: true } : { title: a('detail.item_unlink_title'),
    body: a('detail.customer_item_remove_message', { item: state.prompt.item.name }), cancel: a('bulk_move.no'), confirm: a('bulk_move.yes'), destructive: false } : null;
  const notice = state.notice ? 'message' in state.notice ? state.notice.message : state.notice.operationError ? adminCustomerOperationError(a(state.notice.key), state.notice.error) :
    a(state.notice.key, state.notice.error === undefined ? undefined : { error: String(state.notice.error) }) : null;
  const apparatusChanged = useCallback(() => { if (current()) controller.apparatusChanged(); }, [current, controller]);
  const childNotice = useCallback((message: string) => { if (current()) controller.childNotice(message); }, [current, controller]);
  const warehousesChanged = useCallback((warehouses: readonly string[]) => { if (current()) controller.warehousesChanged(warehouses); }, [current, controller]);
  const reloadWarehouses = useCallback(async () => {
    if (!current()) throw new Error('Admin customer detail session changed');
    const updated = await controller.loadDetail(); if (!current()) throw new Error('Admin customer detail session changed'); return updated.assigned_warehouses;
  }, [current, controller]);
  const materialWarehouse: AdminCustomerMaterialWarehouseProps | null = mode.management && mode.material && state.detail ? {
    session, witness, isCurrent: current, isInteractive: controlsCurrent, principalRole: 'material_taminotchi', principalRef: state.detail.ref,
    displayName: state.detail.name, assignedWarehouses: state.detail.assigned_warehouses, reloadAssignedWarehouses: reloadWarehouses, onChanged: warehousesChanged, onNotice: childNotice,
    assignedMessage: a('detail.material_scope_message'), chipKeyPrefix: 'admin-material-detail-warehouse-', addButtonKey: 'admin-material-detail-add-warehouse', buttonRadius: 14,
  } : null;
  return { state, detail, overlays, mode, current, interactive, controlsCurrent, generation, overlayGeneration, presentation, locale, a,
    t: (key: string) => localizedGetter(key, locale), title, subtitle, displayName, initials, status, notice, back, materialWarehouse, promptText,
    apparatus: { session, witness, customerRef, materialTaminotchi: mode.material, isCurrent: current, isInteractive: interactive, onChanged: apparatusChanged, onNotice: childNotice },
    toggle: () => { if (interactive()) controller.toggle(); },
    reload: () => { if (interactive() && controller.getSnapshot().loadError != null) void controller.reload(); },
    savePhone: (captured: AdminCustomerDetail, input: string) => controlsCurrent() ? controller.savePhone(captured, input) : Promise.resolve(false),
    regenerate: () => { if (controlsCurrent()) void controller.regenerate(); }, copy: (code: string) => { if (controlsCurrent()) void controller.copy(code).catch(() => {}); },
    openAssigned: (captured: AdminCustomerDetail) => { if (controlsCurrent()) presentation.openAssigned(captured, overlayGeneration); },
    openAvailable: () => { if (controlsCurrent()) void presentation.openAvailable(overlayGeneration); },
    editGroups: () => { if (controlsCurrent()) void presentation.editGroups(overlayGeneration); }, requestRemove: () => { if (controlsCurrent()) presentation.requestRemove(overlayGeneration); },
    sheetCurrent: (id: number) => current() && presentation.sheetCurrent(id, overlayGeneration),
    sheetInteractive: (id: number) => current() && presentation.sheetInteractive(id, overlayGeneration),
    actOnItem: (id: number, item: SupplierItem) => current() ? presentation.actOnItem(id, item, overlayGeneration) : Promise.resolve(),
    searchGroups: (id: number, query: string) => { if (current()) presentation.searchGroups(id, query, overlayGeneration); },
    toggleGroup: (id: number, group: string, checked: boolean) => { if (current()) presentation.toggleGroup(id, group, checked, overlayGeneration); },
    beginCloseSheet: (id: number, saveGroups = false) => current() && presentation.beginCloseSheet(id, saveGroups, overlayGeneration),
    nativeBeginDismiss: (id: number) => { if (current()) presentation.nativeBeginDismiss(id, overlayGeneration); },
    finishCloseSheet: (id: number) => { if (current()) presentation.finishCloseSheet(id, overlayGeneration); },
    promptCurrent: (prompt: AdminCustomerDetailPrompt) => current() && presentation.promptCurrent(prompt, overlayGeneration),
    promptInteractive: (prompt: AdminCustomerDetailPrompt) => current() && presentation.promptInteractive(prompt, overlayGeneration),
    choosePrompt: (prompt: AdminCustomerDetailPrompt, confirmed: boolean) => current() && presentation.choosePrompt(prompt, confirmed, overlayGeneration),
    confirmPrompt: (prompt: AdminCustomerDetailPrompt) => presentation.confirmPrompt(prompt, overlayGeneration).catch(() => {}),
    dismissPrompt: (prompt: AdminCustomerDetailPrompt) => presentation.dismissPrompt(prompt, overlayGeneration),
  };
}
export type AdminCustomerDetailScreenModel = ReturnType<typeof useAdminCustomerDetail>;

/** Native controls cannot survive the original panel's collapse/reopen. */
export function useAdminCustomerControls(model: AdminCustomerDetailScreenModel) {
  const attached = useRef(true);
  // Presence must be established before a genuine descendant starts in its child-first layout effect.
  // StrictMode replays layout resources without unmounting this native view's insertion lifetime.
  useInsertionEffect(() => { attached.current = true; return () => { attached.current = false; }; }, []);
  const parentCurrent = model.current, lifetimeCurrent = useCallback(() => attached.current && parentCurrent(), [parentCurrent]);
  const current = () => attached.current && model.controlsCurrent();
  return { current, lifetimeCurrent,
    regenerate: () => { if (current()) model.regenerate(); }, copy: () => { if (current()) model.copy(model.detail.code); },
    openAssigned: () => { if (current()) model.openAssigned(model.detail); }, openAvailable: () => { if (current()) model.openAvailable(); },
    editGroups: () => { if (current()) model.editGroups(); }, requestRemove: () => { if (current()) model.requestRemove(); },
  };
}
/** The material child can disappear on a read error while its surrounding controls stay mounted. */
export function useAdminCustomerWarehouseProps(warehouse: AdminCustomerMaterialWarehouseProps, parentCurrent: () => boolean, parentInteractive: () => boolean): AdminCustomerMaterialWarehouseProps {
  const attached = useRef(true);
  useInsertionEffect(() => { attached.current = true; return () => { attached.current = false; }; }, []);
  const current = useCallback(() => attached.current && parentCurrent(), [parentCurrent]);
  const { onChanged, onNotice, reloadAssignedWarehouses } = warehouse;
  const changed = useCallback((values: readonly string[]) => { if (current()) onChanged(values); }, [current, onChanged]);
  const notice = useCallback((message: string) => { if (current()) onNotice(message); }, [current, onNotice]);
  const reload = useCallback(async () => { if (!current()) throw new Error('Admin customer detail warehouse editor changed');
    const values = await reloadAssignedWarehouses(); if (!current()) throw new Error('Admin customer detail warehouse editor changed'); return values;
  }, [current, reloadAssignedWarehouses]);
  return { ...warehouse, isCurrent: current, isInteractive: () => attached.current && parentInteractive(), onChanged: changed, onNotice: notice, reloadAssignedWarehouses: reload };
}
/** @v2 _CustomerPhoneInlineFieldState, including its retained local buffer after empty/failed submits. */
export function useAdminCustomerPhoneEditor(model: AdminCustomerPhoneModel, buffer: { get: () => string; set: (text: string) => void }) {
  const { detail } = model, [editor, setEditor] = useState<number | null>(null), previousPhone = useRef(detail.phone);
  const lifetime = useRef({ active: false, serial: 0, nextEditor: 0, editor: null as number | null, saving: model.savingPhone });
  useLayoutEffect(() => { const ticket = lifetime.current; ticket.active = true; ticket.serial++; return () => { ticket.active = false; ticket.editor = null; ticket.serial++; }; }, []);
  useLayoutEffect(() => { lifetime.current.saving = model.savingPhone; }, [model.savingPhone]);
  useEffect(() => { const previous = previousPhone.current; previousPhone.current = detail.phone;
    if (previous !== detail.phone && lifetime.current.editor === null && model.current()) buffer.set(dartTrim(detail.phone)); }, [buffer, detail.phone, model]);
  const submit = async () => {
    if (!lifetime.current.active || lifetime.current.saving || editor === null || lifetime.current.editor !== editor || !model.interactive()) return;
    const original = lifetime.current.serial, handled = await model.savePhone(detail, buffer.get());
    if (handled && lifetime.current.active && lifetime.current.serial === original && lifetime.current.editor === editor && model.current()) { lifetime.current.editor = null; setEditor(null); }
  };
  return { editing: editor !== null, submit, action: () => {
    if (!lifetime.current.active || lifetime.current.saving || !model.interactive()) return;
    if (editor !== null) void submit(); else if (lifetime.current.editor === null) { const value = ++lifetime.current.nextEditor; lifetime.current.editor = value; setEditor(value); }
  } };
}
/** Both typed prompts close their native host before the original confirmation callback runs. */
export function useAdminCustomerPromptHost(model: AdminCustomerDetailScreenModel) {
  const prompt = model.state.prompt!, [decision, setDecision] = useState<boolean | null>(null), gate = useRef({ active: false, chosen: false, sent: false });
  useLayoutEffect(() => { const ticket = gate.current; ticket.active = true; return () => { ticket.active = false; }; }, []);
  useEffect(() => { if (decision === null || !gate.current.active || gate.current.sent) return; gate.current.sent = true;
    if (!model.promptCurrent(prompt)) return; if (decision) void model.confirmPrompt(prompt); else model.dismissPrompt(prompt); }, [decision, model, prompt]);
  return { visible: decision === null, choose: (confirmed: boolean) => {
    if (!gate.current.active || gate.current.chosen || !model.choosePrompt(prompt, confirmed)) return; gate.current.chosen = true; setDecision(confirmed);
  } };
}

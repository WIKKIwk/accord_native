import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter, uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWorkerDetailScreenProps } from './AdminWorkerDetailTypes';
import { adminWorkerDetailSession } from './adminWorkerDetailSession';
import { adminWorkerDetailDisplay, adminWorkerDetailDialogText, adminWorkerDetailInitials } from './adminWorkerDetailPresentation';
import { adminWorkerDetailApparatusLabels, adminWorkerDetailIsPreparation, adminWorkerDetailIsSystem, adminWorkerDetailWarehouseEnabled } from './adminWorkerDetailModel';
import type { AdminWorkerDetailEditorController } from './adminWorkerDetailEditorController';
import type { AdminWorkerDetailMaterial, AdminWorkerDetailResponsibility } from './adminWorkerDetailAssignmentsApi';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminWorkerDetail(props: AdminWorkerDetailScreenProps) {
  const { session, witness, isCurrent, entry, readOnly = false, onBack, onOpenActivity } = props;
  const owner = useMemo(() => adminWorkerDetailSession(session, witness, isCurrent, entry, readOnly), [session, witness, isCurrent, entry, readOnly]);
  const { controller, warehouseEditor, materialEditor } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const warehouseState = useSyncExternalStore(warehouseEditor.subscribe, warehouseEditor.getSnapshot, warehouseEditor.getSnapshot);
  const materialState = useSyncExternalStore(materialEditor.subscribe, materialEditor.getSnapshot, materialEditor.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false), leaving = useRef(false);
  const warehouseEnabled = adminWorkerDetailWarehouseEnabled(entry, readOnly), preparation = adminWorkerDetailIsPreparation(entry), system = adminWorkerDetailIsSystem(entry);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; leaving.current = false; controller.start();
    return () => { mounted.current = false; warehouseEditor.dispose(); materialEditor.dispose(); controller.dispose(); }; }, [controller, warehouseEditor, materialEditor]);
  useLayoutEffect(() => { if (!warehouseEnabled || !state.expanded) return; warehouseEditor.start(); return () => warehouseEditor.dispose(); }, [warehouseEnabled, state.expanded, warehouseEditor]);
  useLayoutEffect(() => { if (!preparation || readOnly) return; materialEditor.start(); return () => materialEditor.dispose(); }, [preparation, readOnly, materialEditor]);
  useEffect(() => { const retire = () => { if (!owner.current()) { controller.invalidate(); warehouseEditor.invalidate(); materialEditor.invalidate(); } };
    const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe; }, [owner, controller, warehouseEditor, materialEditor]);
  useEffect(() => { if (!state.notice) return; const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000); return () => clearTimeout(timer); }, [controller, state.notice]);
  const generation = controller.interactionGeneration, phoneGeneration = controller.phoneInteractionGeneration;
  const scopeCurrent = useCallback(() => mounted.current && !leaving.current && generation === controller.interactionGeneration && controller.isCurrent(), [controller, generation]);
  const current = useCallback(() => focus.current && scopeCurrent(), [scopeCurrent]);
  const topOverlay = useCallback(() => {
    const overlays = ([warehouseEditor, materialEditor] as const).flatMap(editor => {
      const value = editor.getSnapshot(); return [...(value.picker ? [{ editor, id: value.picker.id, type: 'picker' as const }] : []), ...(value.dialog ? [{ editor, id: value.dialog.id, type: 'dialog' as const }] : [])];
    }); return overlays.sort((a, b) => b.id - a.id)[0] ?? null;
  }, [warehouseEditor, materialEditor]);
  const interactive = () => current() && topOverlay() === null;
  const controlsCurrent = () => interactive() && !readOnly && controller.getSnapshot().expanded && phoneGeneration === controller.phoneInteractionGeneration;
  const back = useCallback(() => {
    if (!current()) return false;
    const overlay = topOverlay(); if (overlay) { if (overlay.type === 'picker') overlay.editor.dismissPicker(overlay.id); else overlay.editor.dismissDialog(overlay.id); return true; }
    leaving.current = true;
    try { onBack(controller.getSnapshot().changed); } catch (error) { leaving.current = false; throw error; }
    return true;
  }, [current, topOverlay, onBack, controller]);
  useFocusEffect(useCallback(() => { if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', back); return () => subscription.remove(); }, [back]));
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), u = (value: string) => uiText(value, locale), detail = adminWorkerDetailDisplay(state, entry, locale);
  const editorFacade = (editor: AdminWorkerDetailEditorController, value: typeof warehouseState) => {
    const original = editor.interactionGeneration, active = () => current() && original === editor.interactionGeneration && editor.isCurrent();
    const overlayCurrent = (id: number) => active() && topOverlay()?.id === id;
    return { state: value, identity: editor, generation: original, canInteract: active, canInteractOverlay: overlayCurrent, warehouses: editor.visibleWarehouses(), materials: editor.visibleMaterials(),
      dialogText: value.dialog ? adminWorkerDetailDialogText(value.dialog, locale) : null,
      add: () => { if (active() && topOverlay() === null) void editor.add(); },
      removeWarehouse: (warehouse: string) => { if (active() && topOverlay() === null) editor.requestRemove(warehouse); },
      removeMaterial: (material: AdminWorkerDetailResponsibility) => { if (active() && topOverlay() === null) editor.requestRemove(material); },
      search: (id: number, query: string) => { if (overlayCurrent(id)) editor.search(id, query); },
      selectWarehouse: (id: number, name: string) => { if (overlayCurrent(id)) editor.selectWarehouse(id, name); },
      confirmWarehouse: (id: number) => { if (overlayCurrent(id)) void editor.confirmWarehouse(id); },
      selectMaterial: (id: number, material: AdminWorkerDetailMaterial) => { if (overlayCurrent(id)) void editor.selectMaterial(id, material); },
      materialScroll: (id: number, extentAfter: number) => { if (overlayCurrent(id)) editor.materialScroll(id, extentAfter); },
      retryMaterial: (id: number) => { if (overlayCurrent(id)) editor.retryMaterial(id); },
      dismissPicker: (id: number) => { if (overlayCurrent(id)) editor.dismissPicker(id); },
      confirmRemove: (id: number) => { if (overlayCurrent(id)) void editor.confirmRemove(id); },
      dismissDialog: (id: number) => { if (overlayCurrent(id)) editor.dismissDialog(id); },
    };
  };
  const warehouse = editorFacade(warehouseEditor, warehouseState), material = editorFacade(materialEditor, materialState);
  const warehouseOverlay = warehouseState.picker ? { id: warehouseState.picker.id, type: 'picker' as const, editor: warehouse }
    : warehouseState.dialog ? { id: warehouseState.dialog.id, type: 'dialog' as const, editor: warehouse } : null;
  const materialOverlay = materialState.picker ? { id: materialState.picker.id, type: 'picker' as const, editor: material }
    : materialState.dialog ? { id: materialState.dialog.id, type: 'dialog' as const, editor: material } : null;
  const warehouseOverlayId = warehouseState.picker?.id ?? warehouseState.dialog?.id ?? null, materialOverlayId = materialState.picker?.id ?? materialState.dialog?.id ?? null;
  const overlays = warehouseOverlayId !== null && materialOverlayId !== null ? warehouseOverlayId < materialOverlayId ? [warehouseOverlay!, materialOverlay!] : [materialOverlay!, warehouseOverlay!]
    : warehouseOverlayId !== null ? [warehouseOverlay!] : materialOverlayId !== null ? [materialOverlay!] : [];
  const initials = adminWorkerDetailInitials(detail.name), notice = state.notice ? 'message' in state.notice ? u(state.notice.message) : a(state.notice.key, state.notice.values) : null;
  return { state, detail, warehouse, material, overlays, locale, a, u, t: (key: string) => localizedGetter(key, locale), focused, scopeCurrent, current, interactive, generation, phoneGeneration, back,
    warehouseEnabled, preparation, responsibilityEnabled: preparation && !readOnly, system, readOnly, initials, notice,
    status: a(state.loading ? 'detail.loading' : state.loadError ? 'detail.error' : 'detail.ready'), displayName: dartTrim(detail.name) ? detail.name : a('detail.nameless_worker'),
    subtitle: `${dartTrim(detail.level) ? `${dartTrim(detail.level)} • ` : ''}${a('detail.worker_profile')}`, apparatusLabels: adminWorkerDetailApparatusLabels(state.profile, state.apparatus),
    toggle: () => { if (!interactive() || readOnly) return; const expanded = !controller.getSnapshot().expanded; if (!expanded) warehouseEditor.dispose(); controller.expand(expanded, detail); },
    changePhone: (value: string) => { if (controlsCurrent()) controller.changePhone(value); },
    phoneAction: () => { if (!controlsCurrent() || controller.getSnapshot().savingPhone) return; if (controller.getSnapshot().phoneEditing) void controller.savePhone(detail); else controller.editPhone(); },
    submitPhone: () => { if (controlsCurrent()) void controller.savePhone(detail); },
    regenerate: () => { if (controlsCurrent()) void controller.regenerate(); },
    copy: () => { if (controlsCurrent()) void controller.copy(detail.code).catch(() => {}); },
    reload: () => { if (interactive()) void controller.reload(); }, retryProfile: () => { if (interactive()) void controller.reloadProfile(); },
    openActivity: () => { if (interactive() && !readOnly && !system) void Promise.resolve(onOpenActivity(entry)).catch(() => {}); },
  };
}
export type AdminWorkerDetailScreenModel = ReturnType<typeof useAdminWorkerDetail>;
export type AdminWorkerDetailEditorFacade = AdminWorkerDetailScreenModel['warehouse'];
export type AdminWorkerDetailOverlay = AdminWorkerDetailScreenModel['overlays'][number];

import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminSupplierDetailScreenProps } from './AdminSupplierDetailScreenTypes';
import type { AdminSupplierDetailRemovePrompt } from './adminSupplierDetailController';
import type { AdminSupplierDetail } from './adminSupplierDetailModel';
import { createAdminSupplierDetailSession } from './adminSupplierDetailSession';
import { adminWerkaInitials } from './adminWerkaPresentation';
import { dartTrim } from './dartJsonString';
import { useAdminOwnedBack } from './AdminOwnedBackContext';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useAdminSupplierDetail(props: AdminSupplierDetailScreenProps) {
  const { session, witness, isCurrent, supplierRef, readOnly = false, onBack } = props;
  const owner = useMemo(() => createAdminSupplierDetailSession(session, witness, isCurrent, supplierRef, readOnly), [session, witness, isCurrent, supplierRef, readOnly]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const focused = useIsFocused(), focus = useRef(focused), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useEffect(() => { const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    if (!owner.current()) controller.invalidate(); return unsubscribe; }, [owner, controller]);
  useEffect(() => { if (!state.notice) return; const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer); }, [controller, state.notice]);
  const generation = controller.interactionGeneration, current = useCallback(() => owner.current() && controller.isCurrent(generation), [owner, controller, generation]);
  const hostInteractive = props.canInteract;
  const interactive = () => focus.current && current() && (hostInteractive === undefined || isSynchronouslyTrue(hostInteractive)) && current();
  const back = () => {
    if (!interactive() || controller.getSnapshot().phase === 'removed') return;
    const prompt = controller.getSnapshot().removePrompt;
    if (prompt) controller.dismissRemove(prompt); else onBack(controller.getSnapshot().changed);
  };
  useAdminOwnedBack(back);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!focus.current || !current() || hostInteractive !== undefined && !isSynchronouslyTrue(hostInteractive) || !current()) return false;
      if (controller.getSnapshot().phase === 'removed') return true;
      const prompt = controller.getSnapshot().removePrompt;
      if (prompt) controller.dismissRemove(prompt); else onBack(controller.getSnapshot().changed);
      return true;
    }); return () => subscription.remove();
  }, [controller, current, onBack, hostInteractive]));
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const displayName = dartTrim(state.detail?.name ?? '') || a('detail.supplier_missing');
  const notice = state.notice ? a(state.notice.key, state.notice.key === 'detail.phone_save_failed' ? { error: String(state.notice.error) } : undefined) : null;
  const promptIsCurrent = (prompt: AdminSupplierDetailRemovePrompt) => current() && controller.getSnapshot().removePrompt === prompt;
  return { state, generation, current, interactive, displayName, initials: dartTrim(displayName) ? adminWerkaInitials(displayName) : 'Y', readOnly,
    a, t: (key: string) => localizedGetter(key, locale), locale, notice, back, promptIsCurrent,
    toggle: () => { if (interactive()) controller.toggle(); },
    reload: () => { if (interactive() && controller.getSnapshot().phase === 'error') void controller.reload(); },
    savePhone: (detail: AdminSupplierDetail, phone: string) => interactive() ? controller.savePhone(detail, phone) : Promise.resolve(false),
    toggleBlocked: (detail: AdminSupplierDetail) => { if (interactive()) void controller.toggleBlocked(detail).catch(() => {}); },
    regenerate: () => { if (interactive()) void controller.regenerate().catch(() => {}); },
    copy: (code: string) => { if (interactive()) void controller.copy(code).catch(() => {}); },
    requestRemove: () => { if (interactive() && !controller.getSnapshot().removePrompt) controller.requestRemove(); },
    dismissRemove: (prompt: AdminSupplierDetailRemovePrompt) => { if (promptIsCurrent(prompt)) controller.dismissRemove(prompt); },
    confirmRemove: async (prompt: AdminSupplierDetailRemovePrompt) => {
      if (!promptIsCurrent(prompt)) return;
      try { if (await controller.confirmRemove(prompt) && current()) onBack(true); } catch {}
    },
    viewItems: () => { if (interactive() && !props.readOnly && controller.getSnapshot().phase === 'content') void props.onViewItems(supplierRef); },
    addItem: () => { if (interactive() && !props.readOnly && controller.getSnapshot().phase === 'content') void props.onAddItem(supplierRef); },
  };
}
export type AdminSupplierDetailScreenModel = ReturnType<typeof useAdminSupplierDetail>;

/** @v2 _SupplierPhoneInlineFieldState: a child-owned TextEditingController. */
export function useAdminSupplierPhoneEditor(model: AdminSupplierDetailScreenModel, buffer: { get: () => string; set: (text: string) => void }) {
  const detail = model.state.detail!, [editor, setEditor] = useState<number | null>(null), previousPhone = useRef(detail.phone);
  const lifetime = useRef({ active: false, serial: 0, nextEditor: 0, editor: null as number | null, saving: model.state.savingPhone });
  useLayoutEffect(() => { const ticket = lifetime.current; ticket.active = true; ticket.serial++; return () => { ticket.active = false; ticket.editor = null; ticket.serial++; }; }, []);
  useLayoutEffect(() => { lifetime.current.saving = model.state.savingPhone; }, [model.state.savingPhone]);
  useEffect(() => {
    const previous = previousPhone.current; previousPhone.current = detail.phone;
    if (previous !== detail.phone && lifetime.current.editor === null && model.current()) buffer.set(dartTrim(detail.phone));
  }, [buffer, detail.phone, model]);
  const submit = async () => {
    if (!lifetime.current.active || lifetime.current.saving || editor === null || lifetime.current.editor !== editor || !model.interactive()) return;
    const original = lifetime.current.serial;
    const handled = await model.savePhone(detail, buffer.get());
    if (handled && lifetime.current.active && lifetime.current.serial === original && lifetime.current.editor === editor && model.current()) {
      lifetime.current.editor = null; setEditor(null);
    }
  };
  return { editing: editor !== null, submit,
    action: () => {
      if (!lifetime.current.active || lifetime.current.saving || !model.interactive()) return;
      if (editor !== null) void submit();
      else if (lifetime.current.editor === null) { const value = ++lifetime.current.nextEditor; lifetime.current.editor = value; setEditor(value); }
    },
  };
}

/** Close the original platform host before issuing the command; never consume its controller prompt early. */
export function useAdminSupplierRemoveHost(model: AdminSupplierDetailScreenModel) {
  const prompt = model.state.removePrompt!, [decision, setDecision] = useState<boolean | null>(null), gate = useRef({ active: false, chosen: false, sent: false });
  useLayoutEffect(() => { const ticket = gate.current; ticket.active = true; return () => { ticket.active = false; }; }, []);
  useEffect(() => {
    if (decision === null || !gate.current.active || gate.current.sent) return;
    gate.current.sent = true;
    if (!model.promptIsCurrent(prompt)) return;
    if (decision) void model.confirmRemove(prompt); else model.dismissRemove(prompt);
  }, [decision, model, prompt]);
  return { visible: decision === null, choose: (confirmed: boolean) => {
    if (!gate.current.active || gate.current.chosen || !model.interactive() || !model.promptIsCurrent(prompt)) return;
    gate.current.chosen = true; setDecision(confirmed);
  } };
}

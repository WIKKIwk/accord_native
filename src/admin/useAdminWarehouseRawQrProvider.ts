import { useIsFocused } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminText, uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminWarehouseMainRawLines } from './AdminWarehouseMainRows';
import { adminWarehouseItemRollsAuthority } from './adminWarehouseItemRollsAuthority';
import { prepareAdminWarehouseRawQr, confirmAdminWarehouseRawQr } from './adminWarehouseRawQrApi';
import { AdminWarehouseRawQrController } from './adminWarehouseRawQrController';
import { adminWarehouseRawQrPreview } from './adminWarehouseRawQrModel';
import { printAdminWarehouseRawQr } from './adminWarehouseRawQrPrint';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
/** Native iOS nested presenter must be rendered inside Main's current details sheet. */
export function useAdminWarehouseRawQrProvider(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const focused = useIsFocused(), focus = useRef(focused), owner = useMemo(() => {
    const authority = adminWarehouseItemRollsAuthority(session, witness, isCurrent), role = session.profile.role;
    const allowed = role === 'admin' || role === 'brigader' || role === 'material_taminotchi', current = () => allowed && authority();
    return { current, controller: new AdminWarehouseRawQrController({ current, prepare: (barcode, orderId, guard) => prepareAdminWarehouseRawQr(session, barcode, orderId, guard), print: printAdminWarehouseRawQr,
      confirm: (barcode, id, guard) => confirmAdminWarehouseRawQr(session, barcode, id, guard) }) };
  }, [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { const check = () => { if (!owner.current()) owner.controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(check); owner.controller.start(); check(); return () => { unsubscribe(); owner.controller.dispose(); }; }, [owner]);
  const a = useMemo(() => (key: string) => adminText(key, locale), [locale]), value = state.presentation;
  const noticeId = value?.notice, presentationId = value?.id;
  useEffect(() => {
    if (noticeId == null || presentationId == null) return;
    const timer = setTimeout(() => owner.controller.dismissNotice(presentationId, noticeId), 4000); return () => clearTimeout(timer);
  }, [owner, noticeId, presentationId]);
  const stock = value?.stock, barcode = stock?.barcode;
  const preview = useMemo(() => barcode === undefined ? null : adminWarehouseRawQrPreview(barcode), [barcode]);
  const details = useMemo(() => stock ? adminWarehouseMainRawLines(stock, a).filter((_line, index) => index !== 1) : [], [stock, a]);
  return { state, presentation: value, a, preview, details, locale, active: !!value && state.valid && owner.current(), open: owner.controller.open,
    error: value?.error ? 'message' in value.error ? value.error.message : a(value.error.key) : null,
    buttonLabel: uiText(value?.printing ? 'Chop etilmoqda…' : 'Qayta chop etish', locale),
    beginDismiss: () => { if (value) owner.controller.beginDismiss(value.id); }, close: () => { if (value) owner.controller.close(value.id); },
    closeButton: () => { if (focus.current && value && owner.controller.currentPresentation(value.id)) owner.controller.close(value.id, true); },
    reprint: () => { if (focus.current && value && owner.controller.currentPresentation(value.id)) void owner.controller.reprint(value.id); },
  };
}
export type AdminWarehouseRawQrProviderModel = ReturnType<typeof useAdminWarehouseRawQrProvider>;

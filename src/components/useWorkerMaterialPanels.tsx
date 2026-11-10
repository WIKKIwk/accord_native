import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { sessionReadScope } from '../sessionReadScope';
import { productionDataRevision } from '../shared/productionDataRevisionRuntime';
import { createMaterialLinkRequests, decideMaterialLinkRequest, materialLinkRequests, useWorkerMaterial, workerMaterialCandidates, type MaterialLinkRoll } from '../workerMaterialLinkApi';
import { MaterialLinkRequestState, WorkerMaterialUseState } from '../workerMaterialState';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerMaterialRollPicker } from './WorkerMaterialRollPicker';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerMaterialPanelProps = { session: Session; orderId: string; apparatusId: string; onChanged: (barcode?: string) => void; allowNewRequests?: boolean; actionsEnabled?: boolean };
type Controller = { refresh: () => Promise<void>; notify: () => void; dispose: () => void };
const appActive = () => !AppState.currentState || AppState.currentState === 'active';
function useMaterialLifecycle(controller: Controller, visibleRef: RefObject<boolean>) {
  useFocusEffect(useCallback(() => {
    visibleRef.current = true;
    controller.notify();
    const app = AppState.addEventListener('change', state => { if (state === 'active') controller.notify(); });
    const unsubscribe = productionDataRevision.subscribe(() => {
      if (productionDataRevision.isCurrentScope && (!AppState.currentState || AppState.currentState === 'active')) controller.notify();
    });
    return () => { visibleRef.current = false; app.remove(); unsubscribe(); };
  }, [controller, visibleRef]));
  useEffect(() => () => controller.dispose(), [controller]);
}
export function useWorkerMaterialUsePanel(props: WorkerMaterialPanelProps) {
  const text = useWorkerOrderText(), [, redraw] = useReducer(value => value + 1, 0);
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const confirm = useRef<((value: boolean) => void) | null>(null), mounted = useRef(true), latest = useRef(props), labels = useRef(text);
  const visible = useRef(false);
  useLayoutEffect(() => { latest.current = props; labels.current = text; }, [props, text]);
  const { session, orderId, apparatusId } = props, scope = sessionReadScope(session);
  const identity = useRef(''), key = JSON.stringify([scope, orderId, apparatusId]);
  useLayoutEffect(() => { identity.current = key; }, [key]);
  // eslint-disable-next-line react-hooks/refs -- Constructor stores these callbacks; only events and async completions read the refs.
  const controller = useMemo(() => new WorkerMaterialUseState({
    current: () => mounted.current && identity.current === key && !!activeSessionToken(session) && scope === sessionReadScope(session), changed: redraw,
    enabled: () => latest.current.actionsEnabled !== false,
    canRefresh: () => visible.current && appActive(),
    read: () => workerMaterialCandidates(session, orderId, apparatusId), use: material => useWorkerMaterial(session, orderId, apparatusId, material),
    used: barcode => latest.current.onChanged(barcode), text: key => labels.current.p(key),
    confirm: material => new Promise<boolean>(resolve => {
      confirm.current = resolve;
      setAlert({ title: labels.current.p('worker.material_use.confirm'), message: `${material.itemName}\n${material.barcode}`,
        confirmLabel: labels.current.p('worker.material_use.yes'), cancelLabel: labels.current.p('worker.material_use.no'),
        onConfirm: () => { confirm.current?.(true); confirm.current = null; setAlert(null); } });
    }),
  }), [session, orderId, apparatusId, scope, key]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; confirm.current?.(false); confirm.current = null; }; }, []);
  useMaterialLifecycle(controller, visible);
  useEffect(() => {
    if (!controller.feedback) return;
    const timer = setTimeout(() => controller.clearFeedback(), 2_000);
    return () => clearTimeout(timer);
  }, [controller, controller.feedback, controller.feedbackText]);
  return { controller, text, alert, dismissAlert: () => { if (mounted.current) setAlert(null); },
    cancelAlert: () => { confirm.current?.(false); confirm.current = null; if (mounted.current) setAlert(null); } };
}
export function useMaterialLinkRequestPanel(props: WorkerMaterialPanelProps) {
  const text = useWorkerOrderText(), [, redraw] = useReducer(value => value + 1, 0), sheet = useNativeSheet();
  const latest = useRef(props), mounted = useRef(true), pendingPick = useRef<((value: string[] | null) => void) | null>(null);
  const visible = useRef(false);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  const { session, orderId, apparatusId } = props, scope = sessionReadScope(session);
  const identity = useRef(''), key = JSON.stringify([scope, orderId, apparatusId]);
  useLayoutEffect(() => { identity.current = key; }, [key]);
  // eslint-disable-next-line react-hooks/refs -- Constructor stores these callbacks; only events and async completions read the refs.
  const controller = useMemo(() => new MaterialLinkRequestState({
    current: () => mounted.current && identity.current === key && !!activeSessionToken(session) && sessionReadScope(session) === scope,
    changed: redraw, allowNew: () => latest.current.allowNewRequests !== false,
    enabled: () => latest.current.actionsEnabled !== false,
    canRefresh: () => visible.current && appActive(),
    read: () => materialLinkRequests(session, orderId, apparatusId), create: barcodes => createMaterialLinkRequests(session, orderId, apparatusId, barcodes),
    cancel: id => decideMaterialLinkRequest(session, id, 'cancel'), linked: () => latest.current.onChanged(),
    pick: (rolls: MaterialLinkRoll[]) => new Promise<string[] | null>(resolve => {
      pendingPick.current = resolve;
      let result: string[] | null = null;
      sheet.open(<WorkerMaterialRollPicker rolls={rolls} select={value => { result = value; sheet.close(); }} />,
        { dismissible: true, heightFraction: 0.7, onDismiss: () => { pendingPick.current?.(result); pendingPick.current = null; } });
    }),
  }), [session, scope, orderId, apparatusId, sheet, key]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pendingPick.current?.(null); pendingPick.current = null; }; }, []);
  useMaterialLifecycle(controller, visible);
  return { controller, text, available: props.allowNewRequests !== false && !!controller.overview?.candidates.length };
}

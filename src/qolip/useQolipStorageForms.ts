import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipInspectionState, QolipPaddonCreateState, type QolipPaddonCreateDraft } from './qolipStorageFormsState';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';

export type QolipPaddonCreateDialogProps = { boundary: QolipHomeReadBoundary; warehouses: readonly string[];
  initial?: Partial<QolipPaddonCreateDraft> | null; close: (draft: QolipPaddonCreateDraft | null) => void };
export type QolipInspectionDialogProps = { boundary: QolipHomeReadBoundary; expected: readonly string[];
  scan: () => Promise<string | null>; close: (codes: readonly string[] | null) => void };

export function useQolipPaddonCreate(props: QolipPaddonCreateDialogProps) {
  const boundary = props.boundary;
  // V2 initState applies the initial draft once; rebuilding options must retain the user's selection.
  const controller = useMemo(() => new QolipPaddonCreateState(props.warehouses, props.initial, boundary), [boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const lifetime = useQolipPassiveBoundary(boundary), snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); return () => controller.suspend(); }, [controller]);
  useLayoutEffect(() => controller.updateWarehouses(props.warehouses), [controller, props.warehouses]);
  const dismiss = () => { if (lifetime.isCurrent() && controller.canAct()) { controller.suspend(); props.close(null); } };
  const submit = () => { if (!lifetime.isCurrent()) return; const draft = controller.submit(); if (draft !== null && lifetime.isCurrent()) { controller.suspend(); props.close(draft); } };
  const invalid = !lifetime.valid || snapshot.invalid;
  return { ...snapshot, invalid, warehouse: invalid ? null : snapshot.warehouse, canSubmit: !invalid && snapshot.canSubmit,
    warehouses: invalid ? [] : controller.warehouses, dismiss, submit,
    choose: (warehouse: string) => { if (lifetime.isCurrent()) controller.choose(warehouse); } };
}

export function useQolipInspection(props: QolipInspectionDialogProps) {
  // The opener belongs to this original dialog lifetime; parent callback identity changes cannot reset scanned codes.
  const controller = useMemo(() => new QolipInspectionState(props.expected, props.boundary, props.scan), [props.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const lifetime = useQolipPassiveBoundary(props.boundary), snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); return () => controller.suspend(); }, [controller]);
  useLayoutEffect(() => controller.updateExpected(props.expected), [controller, props.expected]);
  const dismiss = () => { if (lifetime.isCurrent() && controller.canAct()) { controller.suspend(); props.close(null); } };
  const invalid = !lifetime.valid || snapshot.invalid;
  return { ...snapshot, invalid, codes: invalid ? [] : snapshot.codes, found: invalid ? [] : snapshot.found,
    missing: invalid ? [] : snapshot.missing, unexpected: invalid ? [] : snapshot.unexpected, dismiss,
    cancel: () => { if (controller.canCancel()) dismiss(); },
    save: () => { if (!lifetime.isCurrent()) return; const codes = controller.result(); if (codes !== null && lifetime.isCurrent()) { controller.suspend(); props.close(codes); } },
    scan: () => { if (lifetime.isCurrent()) void controller.scan().catch(() => {}); },
    remove: (key: string) => { if (lifetime.isCurrent()) controller.remove(key); } };
}

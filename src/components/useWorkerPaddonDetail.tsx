import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { AdminApparatus } from '../apparatusApi';
import type { Session } from '../auth';
import { adminText, localizedGetter, localizedMethod } from '../shared/localization';
import { adminPaddonPrintQr } from '../paddonPrintApi';
import { confirmPaddonPrint } from '../paddonConfirmPrintApi';
import { createActivePaddonSuccessor } from '../paddonSuccessorApi';
import { WorkerPaddonPrint } from '../workerPaddonPrint';
import { workerPaddonErrorText } from '../workerPaddonContent';
import { workerPaddonItems, type WorkerPaddonBatch } from '../workerPaddonModel';
import { rezkaPaddonDetailHeader } from '../rezka/rezkaPaddonDetailModel';
import { rezkaPaddonWipContent } from '../rezka/rezkaPaddonWipModel';
import { pickWorkerPrinter, printWorkerJobs, workerPrinterFields, WorkerPrintCancelled } from '../workerPrinting';
import { useNativeSheet } from '../nativeSheet';
import { WorkerWipBatchDetails } from './WorkerWipBatchDetails';
import { useWorkerPaddonOwner, useWorkerPaddonState } from './useWorkerPaddonOwner';
import { useWorkerPaddonPresentation } from './useWorkerPaddonPresentation';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerPaddonDetailProps = { session: Session; code: string; apparatus?: string; onBack(): void };
export function useWorkerPaddonDetail({ session, code, apparatus = '' }: WorkerPaddonDetailProps) {
  const owner = useWorkerPaddonOwner(session, apparatus), controller = useMemo(() => owner.detail(code), [owner, code]);
  const state = useWorkerPaddonState(controller), presentation = useWorkerPaddonPresentation(owner.current), wipSheet = useNativeSheet();
  const printer = useWorkerPrinterSelector(owner.current), { p, t, locale } = useWorkerOrderText();
  const printing = useRef(false);
  const [catalogState, setCatalog] = useState<{ owner: typeof owner; rows: AdminApparatus[] } | null>(() => ({ owner, rows: owner.cachedCatalog() ?? [] }));
  const catalog = useMemo(() => catalogState?.owner === owner ? catalogState.rows : [], [catalogState, owner]);
  useEffect(() => { void controller.load(false); let alive = true;
    void owner.catalog(() => alive, false).then(rows => { if (alive && owner.current()) setCatalog({ owner, rows }); }).catch(() => {});
    return () => { alive = false; };
  }, [controller, owner]);
  const strings = useRef({ p, locale }), presenter = useRef(presentation), printerSelector = useRef(printer.selectDevice);
  useLayoutEffect(() => { strings.current = { p, locale }; presenter.current = presentation; printerSelector.current = printer.selectDevice; }, [p, locale, presentation, printer.selectDevice]);
  // The workflow constructor stores callbacks; it never invokes these event closures during render.
  /* eslint-disable react-hooks/refs */
  const print = useMemo(() => new WorkerPaddonPrint({ code, apparatus, current: controller.current,
    select: async () => { try { return await pickWorkerPrinter({ current: controller.current, selectDevice: () => printerSelector.current() }); }
      catch (error) { if (error instanceof WorkerPrintCancelled) return null; throw error; } },
    prepare: (selected, valid) => adminPaddonPrintQr(session, { code, ...workerPrinterFields(selected), beforeSend: owner.guard(valid) }),
    print: (job, selected, valid) => printWorkerJobs({ print_job: job }, selected, valid),
    confirm: valid => owner.mutate(valid, () => confirmPaddonPrint(session, code, valid)), refresh: () => controller.load(), changed: owner.changed,
    chooseNext: async completion => {
      controller.setPrinting(false); const { p, locale } = strings.current, permit = controller.capture();
      if (await presenter.current.open({ kind: 'successor', title: p('worker.paddon.next.title'), message: p('worker.paddon.next.body', { code }),
        cancelLabel: localizedGetter('no', locale), confirmLabel: localizedGetter('yes', locale) }) !== 'confirm' || !permit()) return null;
      const apparatus = completion.paddon.apparatus_id.trim() || owner.list.getSnapshot().apparatus || completion.apparatus;
      if (apparatus) return apparatus;
      const selected = await presenter.current.open({ title: p('worker.paddon.next.apparatus'),
        choices: Object.entries(completion.apparatus_options).map(([id, title]) => ({ id, title })) });
      return permit() ? selected : null;
    },
    successor: (selected, valid) => { controller.setPrinting(true); return owner.mutate(valid, () => createActivePaddonSuccessor(session, code, selected, valid)); },
    notice: (key, values, error) => presenter.current.message(error ? workerPaddonErrorText(error, strings.current.p, key) : strings.current.p(key, values)),
  }), [controller, owner, session, code, apparatus]);
  /* eslint-enable react-hooks/refs */
  const blocked = !owner.current() || state.busy || state.printing;
  const canManage = !!state.snapshot?.can_manage_items && !blocked;
  const header = useMemo(() => state.snapshot ? rezkaPaddonDetailHeader(state.snapshot, catalog, p, adminText('wip.unspecified', locale),
    count => localizedMethod('productionCount', locale, { count })) : null, [state.snapshot, catalog, p, locale]);
  const batches = useMemo(() => state.snapshot ? workerPaddonItems(state.snapshot, state.mode, state.bobina) : [], [state.snapshot, state.mode, state.bobina]);
  const contents = useMemo(() => batches.map(batch => ({ batch, ...rezkaPaddonWipContent(batch, catalog, session.profile, p) })),
    [batches, catalog, session.profile, p]);
  const selected = useMemo(() => new Set(state.selected), [state.selected]);
  const rows = useMemo(() => contents.map(row => ({ ...row, selected: selected.has(row.batch.batch_id),
    selectable: canManage && !!state.mode && !state.scanning, removable: canManage && !state.mode && !state.scanning && !!row.batch.batch_id.trim() })),
  [contents, selected, canManage, state.mode, state.scanning]);
  const scannedContents = useMemo(() => state.scanned.map(batch => ({ batch, ...rezkaPaddonWipContent(batch, catalog, session.profile, p) })),
    [state.scanned, catalog, session.profile, p]);
  const scanned = useMemo(() => scannedContents.map(row => ({ ...row, selected: selected.has(row.batch.batch_id),
    selectable: canManage && !!state.mode && !state.scanning, removable: canManage && !state.mode && !state.scanning && !!row.batch.batch_id.trim() })),
  [scannedContents, selected, canManage, state.mode, state.scanning]);
  const yesNo = (title: string, message: string, values?: Record<string, unknown>, destructive = false) => presentation.open({ title: p(title), message: p(message, values),
    cancelLabel: localizedGetter('no', locale), confirmLabel: localizedGetter('yes', locale), destructive });
  const showError = (key: string) => presentation.message(workerPaddonErrorText(controller.getSnapshot().error, p, key));
  const cancelScan = async () => {
    if (blocked || presentation.isOpen() || state.review) return false;
    const permit = controller.capture(), scan = controller.getSnapshot();
    if (scan.scanned.length || scan.pending) {
      controller.setReview(true);
      const result = await yesNo('worker.paddon.scan.discard.title', 'worker.paddon.scan.discard.body');
      controller.setReview(false); if (result !== 'confirm' || !permit()) return false;
    }
    controller.cancelScan(); return permit();
  };
  const feedback = state.feedbackKind === 'rejected' && state.error ? workerPaddonErrorText(state.error, p, state.feedback)
    : p(state.feedback || 'worker.paddon.scan.ready', { count: state.scanned.length });
  useEffect(() => {
    if (!state.feedbackKind || !controller.current()) return;
    if (state.feedbackKind !== 'none') void Haptics.notificationAsync(state.feedbackKind === 'accepted' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    const timer = setTimeout(() => controller.clearFeedback(), 2000); return () => clearTimeout(timer);
  }, [controller, state.feedback, state.feedbackKind, state.scanned.length]);
  useEffect(() => { if (!state.scanning && state.error && typeof state.error === 'object' && 'code' in state.error && state.error.code === 'paddon_roll_kind_conflict') {
    showError('worker.paddon.update_failed'); controller.clearError();
  } }, [state.error, state.scanning]); // eslint-disable-line react-hooks/exhaustive-deps
  return { state, controller, presentation, printerDialogs: printer.dialogs, header, p, t, current: controller.current, feedback,
    rows, scanned, blocked, canManage, title: code,
    canPrint: !!state.snapshot && !blocked && !state.scanning, canUnlock: !!state.snapshot?.can_unlock && !blocked && !state.scanning,
    canReview: !blocked && !state.review && state.pending === 0 && state.scanned.length > 0,
    canConfirmScan: canManage && state.pending === 0 && state.scanned.length > 0,
    itemsTitle: p(state.mode === 'add' ? 'worker.paddon.available.title' : 'worker.paddon.assigned.title'),
    itemsEmpty: p(state.mode === 'add' ? 'worker.paddon.available.empty' : 'worker.paddon.assigned.empty'),
    freeMovementHint: state.snapshot?.free_movement_enabled && state.snapshot.can_manage_items ? p('paddon.management.free_movement.hint') : '',
    count: localizedMethod('productionCount', locale, { count: batches.length }),
    blockBack: state.scanning && (state.busy || state.review || state.scanned.length > 0 || state.pending > 0),
    async requestBack(back: () => void) { if (!state.scanning) { back(); return; } if (blocked || presentation.isOpen()) return; if (await cancelScan()) back(); }, cancelScan,
    async print() { const fresh = controller.getSnapshot();
      if (printing.current || !controller.current() || !fresh.snapshot || fresh.busy || fresh.scanning || presentation.isOpen()) return;
      printing.current = true; controller.setPrinting(true);
      try { await print.run(); } finally { printing.current = false; controller.setPrinting(false); } },
    async unlock() { if (blocked || !state.snapshot?.can_unlock || state.scanning) return; const permit = controller.capture();
      if (await yesNo('worker.paddon.unlock.title', 'worker.paddon.unlock.body', { code }) !== 'confirm' || !permit()) return;
      if (await controller.unlock(permit)) { controller.exitSelection(); presentation.message(p('worker.paddon.unlock.success')); } else if (permit()) showError('worker.paddon.unlock.failed'); },
    async edit(mode: 'add' | 'remove') {
      if (!canManage || state.scanning || presentation.isOpen()) return;
      if (state.mode !== mode || !state.selected.length) { controller.edit(mode); return; }
      const ids = [...state.selected], permit = controller.capture();
      const confirmed = await presentation.open({ title: p(`worker.paddon.confirm.${mode}.title`), message: p(`worker.paddon.confirm.${mode}.body.count`, { count: ids.length }),
        cancelLabel: mode === 'add' ? localizedGetter('no', locale) : p('worker.action.cancel'), confirmLabel: mode === 'add' ? localizedGetter('yes', locale) : p('worker.paddon.remove') });
      if (confirmed === 'confirm' && permit()) { const ok = mode === 'add' ? await controller.add(ids, permit) : await controller.remove(ids, false, permit);
        if (!ok && permit()) showError(mode === 'add' ? 'worker.paddon.add_failed' : 'worker.paddon.remove_failed'); }
    },
    async cancelSelection() { if (blocked) return; const permit = controller.capture();
      if (state.selected.length && await yesNo('worker.paddon.confirm.cancel.title', 'worker.paddon.confirm.cancel.body') !== 'confirm') return;
      if (permit()) controller.exitSelection(); },
    async remove(batch: WorkerPaddonBatch) { if (!canManage || state.mode || state.scanning || !batch.batch_id.trim()) return;
      const permit = controller.capture(); if (await yesNo('worker.paddon.confirm.remove.title', 'worker.paddon.confirm.remove.body.count', { count: 1 }, true) !== 'confirm' || !permit()) return;
      if (!await controller.remove([batch.batch_id], true, permit) && permit()) showError('worker.paddon.remove_failed'); },
    async review() { if (blocked || state.review || state.pending || !state.scanned.length) return;
      const permit = controller.capture(); controller.setReview(true);
      const confirmed = await presentation.open({ kind: 'review', title: p('worker.paddon.scan.pending', { count: state.scanned.length }),
        cancelLabel: p('worker.action.close'), confirmLabel: p('worker.paddon.scan.confirm', { count: state.scanned.length }) });
      if (!permit()) return; controller.setReview(false); if (confirmed === 'confirm') await controller.confirmScan(permit);
    },
    openWip(batch: WorkerPaddonBatch) { if (blocked || presentation.isOpen() || wipSheet.isOpen()) return;
      if (!batch.qr_payload.trim()) { presentation.message(p('worker.daily.wip_qr_missing.body')); return; }
      const order = { id: batch.order_id, code: String(batch.payload_json.order_number ?? ''), title: String(batch.payload_json.order_title ?? batch.label_item_name), imageId: '', apparatusId: batch.apparatus };
      wipSheet.open(<WorkerWipBatchDetails session={session} order={order} batch={batch} apparatusNames={Object.fromEntries(catalog.map(row => [row.id, row.name]))}
        onClose={wipSheet.close} allowReprint isCurrent={controller.current} />, { dismissible: true });
    },
  };
}

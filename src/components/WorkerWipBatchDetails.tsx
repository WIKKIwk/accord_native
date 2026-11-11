import qrFactory from 'qrcode-generator';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { reprintWorkerWip, WorkerPrintCancelled } from '../workerPrinting';
import { sessionReadScope } from '../sessionReadScope';
import { wipText, type WipApparatusNames, type WipBatch, type WipOrder } from '../workerWip';
import { workerWipDetailRows, workerWipDetailsItemName } from '../workerWipDetailsPresentation';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
import { WorkerWipBatchDetailsView } from './WorkerWipBatchDetailsView';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { useWorkerOrderText } from './useWorkerOrderText';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';

Object.assign(qrFactory, { stringToBytes: (text: string) => Array.from(new TextEncoder().encode(text)) });

function canReprint(session: Session, batch: WipBatch) {
  const worker = wipText(session.profile.ref);
  return !!worker && worker === wipText(batch.worker_ref) &&
    wipText(batch.payload_json?.input_wip_source_kind).toLowerCase() !== 'opening_wip';
}

export function WorkerWipBatchDetails({ session, order, batch, apparatusNames, onClose, onEdit, allowReprint, isCurrent, title, itemName, detailRows }: {
  session: Session; order: WipOrder; batch: WipBatch; apparatusNames: WipApparatusNames; onClose: () => void; onEdit?: () => void; allowReprint?: boolean; isCurrent?: () => boolean;
  title?: string; itemName?: string; detailRows?: [string, string][];
}) {
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const { p, t } = useWorkerOrderText();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const printing = useRef(false);
  const mounted = useRef(true), scope = useRef(sessionReadScope(session));
  const current = () => mounted.current && !!activeSessionToken(session) && scope.current === sessionReadScope(session) && (isCurrent?.() ?? true);
  const printer = useWorkerPrinterSelector(current);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const payload = wipText(batch.qr_payload);
  const qrImage = useMemo(() => {
    try {
      const code = qrFactory(0, 'M');
      code.addData(payload);
      code.make();
      return code.createDataURL(5, 20);
    } catch { return ''; }
  }, [payload]);
  const rows = detailRows ?? workerWipDetailRows(batch, apparatusNames, session.profile, p);

  async function reprint() {
    if (printing.current || !current() || !(allowReprint ?? canReprint(session, batch))) return;
    printing.current = true;
    setBusy(true);
    setMessage('');
    try {
      await reprintWorkerWip(session, { batch_id: wipText(batch.batch_id), qr_payload: payload }, { current, selectDevice: printer.selectDevice });
      if (current()) setNotice(p('worker.daily.wip_qr.reprinted'));
    } catch (reason) { if (current() && !(reason instanceof WorkerPrintCancelled)) setMessage(reason instanceof Error ? reason.message : 'WIP QR kodi chop etilmadi.'); }
    finally { printing.current = false; if (current()) setBusy(false); }
  }

  return <View style={{ flex: 1 }}>
    <WorkerWipBatchDetailsView session={session} order={order} title={title ?? p('worker.wip.history.title')}
      itemName={itemName ?? workerWipDetailsItemName(order, batch, p)} payload={payload} qrImage={qrImage}
      rows={rows.map(([label, value]) => [t(label), value])} message={message} busy={busy}
      editLabel={t('WIPni o‘zgartirish')} closeLabel={t('Yopish')} reprintLabel={t(busy ? 'Chop etilmoqda…' : 'Qayta chop etish')}
      canReprint={allowReprint ?? canReprint(session, batch)} onReprint={() => { void reprint(); }}
      onEdit={onEdit ? () => { if (!printing.current) { onEdit(); close(); } } : undefined}
      onClose={() => { if (!printing.current) close(); }} />
    {printer.dialogs}<WorkerPaddonFeedback message={notice} />
  </View>;
}

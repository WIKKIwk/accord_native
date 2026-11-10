import { Button, Column, Host, ListItem } from '@expo/ui';
import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { reprintWorkerWip, WorkerPrintCancelled } from '../workerPrinting';
import { sessionReadScope } from '../sessionReadScope';
import { wipAmount, wipBatchRows, wipBatchStatus, wipBatchWeights, wipText, type WipApparatusNames, type WipBatch, type WipOrder } from '../workerWip';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';
import { WorkerSheetCloseContext } from './workerSheetContext';

Object.assign(qrFactory, { stringToBytes: (text: string) => Array.from(new TextEncoder().encode(text)) });

const weight = (item: number | null) => item === null ? '—' : `${Number(item.toFixed(6))} kg`;

function canReprint(session: Session, batch: WipBatch) {
  const worker = wipText(session.profile.ref);
  return !!worker && worker === wipText(batch.worker_ref) &&
    wipText(batch.payload_json?.input_wip_source_kind).toLowerCase() !== 'opening_wip';
}

export function WorkerWipBatchDetails({ session, order, batch, apparatusNames, onClose }: {
  session: Session; order: WipOrder; batch: WipBatch; apparatusNames: WipApparatusNames; onClose: () => void;
}) {
  const colors = useWorkerColors();
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const printing = useRef(false);
  const mounted = useRef(true), scope = useRef(sessionReadScope(session));
  const current = () => mounted.current && !!activeSessionToken(session) && scope.current === sessionReadScope(session);
  const printer = useWorkerPrinterSelector(current);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const payload = wipText(batch.qr_payload);
  const qrImage = useMemo(() => {
    try {
      const code = qrFactory(0, 'M');
      code.addData(payload);
      code.make();
      return code.createDataURL(5, 20);
    } catch { return ''; }
  }, [payload]);
  const { gross, net, bobina } = wipBatchWeights(batch);
  const rows = [...wipBatchRows(batch, apparatusNames),
    ['Holat', wipBatchStatus(batch)], ['Brutto og‘irlik', weight(gross)],
    ['Netto og‘irlik', weight(net)], ['Bobina og‘irligi', weight(bobina)],
    ['Metraj', wipAmount(batch.finished_goods_meter) !== null ? `${batch.finished_goods_meter} m` : ''],
    ['Diametr', wipAmount(batch.diameter) !== null ? String(batch.diameter) : ''],
    ['Izoh', wipText(batch.description)], ['EPC', payload],
  ].filter(([, value]) => value);

  async function reprint() {
    if (printing.current || !activeSessionToken(session) || !canReprint(session, batch)) return;
    printing.current = true;
    setBusy(true);
    setMessage('');
    try {
      await reprintWorkerWip(session, { batch_id: wipText(batch.batch_id), qr_payload: payload }, { current, selectDevice: printer.selectDevice });
      if (current()) setMessage('WIP QR kodi qayta chop etildi.');
    } catch (reason) { if (current() && !(reason instanceof WorkerPrintCancelled)) setMessage(reason instanceof Error ? reason.message : 'WIP QR kodi chop etilmadi.'); }
    finally { printing.current = false; if (current()) setBusy(false); }
  }

  return <View style={styles.fill}>
    <View style={styles.header}>
      <Text style={[styles.title, styles.fill, { color: colors.text }]}>WIP tafsilotlari</Text>
      <WorkerIconButton icon="close" label="Yopish" onPress={close} tonal />
    </View>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <WorkerOrderThumbnail session={session} orderId={order.id} imageId={order.imageId} active
          backgroundColor={colors.surface} iconColor={colors.icon} />
        <Text style={[styles.title, styles.fill, { color: colors.text }]}>{[order.code, order.title].filter(Boolean).join(' • ')}</Text>
      </View>
      {qrImage ? <Image source={{ uri: qrImage }} style={styles.qr} contentFit="contain" cachePolicy="none" accessibilityLabel="WIP QR kodi" /> :
        <Text selectable style={{ color: colors.text }}>{payload}</Text>}
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>{rows.map(([label, value]) => <ListItem key={label} supportingText={value}>{label}</ListItem>)}</Column>
      </Host>
      {canReprint(session, batch) && <>
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <Column spacing={8}>
            <Button label={busy ? 'Chop etilmoqda…' : 'QR kodni qayta chop etish'} disabled={busy} onPress={() => { void reprint(); }} />
          </Column>
        </Host>
      </>}
      {!!message && <Text accessibilityRole="alert" style={{ color: colors.text }}>{message}</Text>}
    </ScrollView>{printer.dialogs}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, header: { paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700' }, content: { padding: 12, gap: 12, paddingBottom: 28 },
  qr: { width: 208, height: 208, alignSelf: 'center', backgroundColor: '#fff' }, host: { width: '100%' },
});

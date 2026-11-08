import { AlertDialog, Button, Column, FilledTonalButton, Host, IconButton, OutlinedButton, OutlinedTextField, RNHostView, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useNativeState } from '@expo/ui';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RezkaItemPicker } from './RezkaItemPicker';
import { formatRezkaQty, type RezkaDraft } from './rezkaSplitLogic';
import { isExcludedRezkaPrinter, rezkaSplitNoticeText } from './rezkaSplitController';
import type { RezkaSplitScreenProps } from './rezkaSplitScreenTypes';
import { useRezkaPrintUnavailableText, useRezkaSplit, useRezkaText } from './useRezkaSplit';

type FieldProps = { label: string; value: string; change(value: string): void; submit?: () => void; decimal?: boolean; multiline?: boolean };
function Field({ label, value, change, submit, decimal, multiline }: FieldProps) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={native} onValueChange={change} singleLine={!multiline}
    keyboardOptions={{ keyboardType: decimal ? 'decimal' : 'text', ...(submit ? { imeAction: 'search' } : {}) }}
    keyboardActions={submit ? { onSearch: submit } : undefined} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField></Host>;
}
function Label({ children }: { children: string }) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{children}</Text></Host>;
}
function Action({ label, press, disabled = false, id, outlined = false }: { label: string; press(): void; disabled?: boolean; id?: string; outlined?: boolean }) {
  const NativeButton = outlined ? OutlinedButton : Button;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><NativeButton enabled={!disabled} onClick={press}
    modifiers={[fillMaxWidth(), ...(id ? [testID(id)] : [])]}><Text>{label}</Text></NativeButton></Host>;
}
function RemainderDialog({ sourceQty, total, remainder, uom, choose }: { sourceQty: number; total: number; remainder: number; uom: string;
  choose(value: 'forgot' | 'scrap' | 'cancel'): void }) {
  const { width, height } = useWindowDimensions(), t = useRezkaText();
  const message = `Bo‘linayotgan mahsulot ${formatRezkaQty(sourceQty)} ${uom}. Siz kiritgan bo‘laklar jami ${formatRezkaQty(total)} ${uom}. ${formatRezkaQty(remainder)} ${uom} qoldi. Xato qildingizmi?`;
  return <Host style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={() => choose('cancel')}><AlertDialog.Title><Text>{t('Miqdor yetmayapti')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column><Text>{t(message)}</Text><Button onClick={() => choose('forgot')}><Text>{t('Unutibman')}</Text></Button>
        <FilledTonalButton onClick={() => choose('scrap')}><Text>{t('Brak mahsulot')}</Text></FilledTonalButton></Column></AlertDialog.Text>
      <AlertDialog.ConfirmButton><TextButton onClick={() => choose('cancel')}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

// A missing reviewed printer bridge leaves the source and form available but prevents every mutation.
export function RezkaSplitScreen({ snapshot, printer, scan, onBack }: RezkaSplitScreenProps) {
  const { controller, state, device, choosePrinter, scan: scanCode, isCurrent } = useRezkaSplit(snapshot, printer);
  const printerUnavailable = useRezkaPrintUnavailableText();
  const t = useRezkaText(), colors = useMaterialColors(), itemSheet = useNativeSheet(), [printerOpen, setPrinterOpen] = useState(false);
  const openItem = (index: number) => {
    if (!isCurrent()) return;
    const key = controller.getSnapshot().outputs[index]?.key;
    if (key == null) return;
    itemSheet.open(<RezkaItemPicker snapshot={snapshot} select={item => {
      const currentIndex = controller.getSnapshot().outputs.findIndex(output => output.key === key);
      if (isCurrent() && currentIndex >= 0) controller.selectItem(currentIndex, item);
      itemSheet.close();
    }} />, { dismissible: true });
  };
  const source = state.source;
  const renderOutput = (output: RezkaDraft, index: number) => <WorkerQueueCard key={output.key ?? index} first last backgroundColor={colors.surfaceContainerLowest}>
    <View style={{ flex: 1, gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}><Label>{t(`${output.print_qr ? 'Bo‘lak' : 'Atxot'} ${index + 1}`)}</Label></View>
      {state.outputs.length > 2 ? <Host matchContents><IconButton onClick={() => controller.removeOutput(index)} modifiers={[semantics({ contentDescription: t('Yopish') })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host> : null}
    </View>
    {output.print_qr ? <Action label={output.item_code.trim() ? `${output.item_name} (${output.item_code})` : t('Mahsulot tanlang')} outlined press={() => openItem(index)} />
      : <><Label>{t('Atxot: QR chiqarilmaydi')}</Label><Label>{t('Mahsulot tanlash shart emas')}</Label></>}
    <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label={t('Qty')} value={output.qty} decimal change={value => controller.editOutput(index, { qty: value })} /></View>
      <View style={{ flex: 1 }}><Field label={t('UOM')} value={output.uom} change={value => controller.editOutput(index, { uom: value })} /></View></View>
    <Field label={t('Location')} value={output.warehouse} change={value => controller.editOutput(index, { warehouse: value })} />
    <Field label={t('Bo‘lak sababi')} value={output.reason} multiline change={value => controller.editOutput(index, { reason: value })} />
    </View>
  </WorkerQueueCard>;
  if (!isCurrent()) return null;
  const notice = state.notice ? rezkaSplitNoticeText(state.notice) : null;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ headerShown: false }} /><RoleHeader title="Rezka" subtitle={t('Mahsulotni bo‘lish')} navigation={onBack ? { icon: 'back', label: t('Orqaga'), onPress: onBack } : undefined} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 120 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}><View style={{ flex: 1 }}>
        <Field label="Source QR" value={state.barcode} change={value => controller.setBarcode(value)} submit={() => { void controller.loadSource(); }} /></View>
        {scan ? <Host matchContents><IconButton onClick={() => { void scanCode(scan); }} modifiers={[semantics({ contentDescription: t('QR scan') })]}>
          <RNHostView matchContents><SymbolView name={{ android: 'qr_code_scanner' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton></Host> : null}
      </View>
      <View style={{ paddingHorizontal: 16 }}><Action label={t('QR ni tekshirish')} id="rezka-check-source" disabled={state.loadingSource} press={() => { void controller.loadSource(); }} />
        {state.loadingSource ? <ActivityIndicator /> : null}</View>
      <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest} {...(printer ? { onPress: () => { void choosePrinter(); } } : {})}>
        <View style={{ flex: 1 }}>{printer ? <><Label>{t(device.title)}</Label><Label>{t(device.subtitle)}</Label></> : <Label>{printerUnavailable}</Label>}</View>
      </WorkerQueueCard>
      {source ? <>
        <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><View style={{ flex: 1 }}>
          <Label>{source.item_name.trim() ? source.item_name : source.item_code}</Label><Label>{source.item_code}</Label>
          <Label>{`${formatRezkaQty(source.qty)} ${source.uom}`}</Label><Label>{source.warehouse}</Label>
        </View></WorkerQueueCard>
        <View style={{ paddingHorizontal: 16 }}><Label>{t('Bo‘laklar')}</Label></View>
        {state.outputs.map(renderOutput)}
        <View style={{ paddingHorizontal: 16, gap: 10 }}><Action label={t('Bo‘lak qo‘shish')} outlined press={() => controller.addOutput()} />
          <Field label={t('Sabab')} value={state.reason} multiline change={value => controller.setReason(value)} />
          {printer ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><TextButton onClick={() => setPrinterOpen(!printerOpen)}><Text>{t('Printer')}</Text></TextButton></Host> : null}
          {printer && printerOpen ? <><Field label={t('Driver URL')} value={state.driverUrl} change={value => controller.setPrinter({ driverUrl: value })} />
            <Field label={t('Printer')} value={state.printer} change={value => controller.setPrinter({ printer: value })} />
            <Field label={t('Mode')} value={state.printMode} change={value => controller.setPrinter({ printMode: value })} /></> : null}
          {printer && !state.uncertain && !state.blockedPrinter && !device.excluded && !(state.transport === 'wifi' && isExcludedRezkaPrinter(state.printer))
            ? <Action label={t('Bo‘lish va QR chiqarish')} id="rezka-submit-split" disabled={state.submitting} press={() => { void controller.submit(); }} /> : null}
          {state.submitting ? <ActivityIndicator /> : null}
        </View>
      </> : null}
    </ScrollView>
    {notice ? <PreparationNotice message={t(notice)} /> : null}
    {state.remainder ? <RemainderDialog sourceQty={state.remainder.source.qty} total={state.remainder.total} remainder={state.remainder.difference}
      uom={state.remainder.source.uom} choose={value => controller.chooseRemainder(value)} /> : null}
  </SafeAreaView>;
}

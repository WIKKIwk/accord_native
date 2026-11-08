import { Alert, Button, DisclosureGroup, Host, HStack, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, disabled, keyboardType, labelStyle, listStyle, onSubmit } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { PlatformColor, View, useWindowDimensions } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { RezkaItemPicker } from './RezkaItemPicker';
import { formatRezkaQty, type RezkaDraft } from './rezkaSplitLogic';
import { isExcludedRezkaPrinter, rezkaSplitNoticeText } from './rezkaSplitController';
import type { RezkaSplitScreenProps } from './rezkaSplitScreenTypes';
import { useRezkaSplit, useRezkaText } from './useRezkaSplit';

type FieldProps = { label: string; value: string; change(value: string): void; submit?: () => void; decimal?: boolean; multiline?: boolean };
function Field({ label, value, change, submit, decimal, multiline }: FieldProps) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <VStack alignment="leading"><Text>{label}</Text><TextField text={native} onTextChange={change} axis={multiline ? 'vertical' : 'horizontal'}
    modifiers={[...(decimal ? [keyboardType('decimal-pad')] : []), ...(submit ? [onSubmit(submit)] : [])]} /></VStack>;
}

function RemainderDialog({ sourceQty, total, remainder, uom, choose }: { sourceQty: number; total: number; remainder: number; uom: string;
  choose(value: 'forgot' | 'scrap' | 'cancel'): void }) {
  const { width, height } = useWindowDimensions(), t = useRezkaText();
  const message = `Bo‘linayotgan mahsulot ${formatRezkaQty(sourceQty)} ${uom}. Siz kiritgan bo‘laklar jami ${formatRezkaQty(total)} ${uom}. ${formatRezkaQty(remainder)} ${uom} qoldi. Xato qildingizmi?`;
  return <Host style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
    <Alert title={t('Miqdor yetmayapti')} isPresented onIsPresentedChange={value => { if (!value) choose('cancel'); }}>
      <Alert.Trigger><Text> </Text></Alert.Trigger><Alert.Message><Text>{t(message)}</Text></Alert.Message>
      <Alert.Actions><Button label={t('Unutibman')} onPress={() => choose('forgot')} />
        <Button label={t('Brak mahsulot')} onPress={() => choose('scrap')} /><Button label={t('Bekor qilish')} role="cancel" onPress={() => choose('cancel')} /></Alert.Actions>
    </Alert>
  </Host>;
}

// V2 RezkaSplitScreen. Requires a real printer bridge; no route is enabled here.
export function RezkaSplitScreen({ session, printer, scan, onBack }: RezkaSplitScreenProps) {
  const { controller, state, device, scope, choosePrinter, scan: scanCode, isCurrent } = useRezkaSplit(session, printer);
  const t = useRezkaText(), itemSheet = useNativeSheet();
  const openItem = (index: number) => {
    if (!isCurrent()) return;
    const key = controller.getSnapshot().outputs[index]?.key;
    if (key == null) return;
    itemSheet.open(<RezkaItemPicker session={session} scope={scope} select={item => {
      const currentIndex = controller.getSnapshot().outputs.findIndex(output => output.key === key);
      if (isCurrent() && currentIndex >= 0) controller.selectItem(currentIndex, item);
      itemSheet.close();
    }} />, { dismissible: true });
  };
  const source = state.source;
  const renderOutput = (output: RezkaDraft, index: number) => <Section key={output.key ?? index}>
    <HStack><Text>{t(`${output.print_qr ? 'Bo‘lak' : 'Atxot'} ${index + 1}`)}</Text>
      {state.outputs.length > 2 ? <Button role="close" onPress={() => controller.removeOutput(index)} /> : null}</HStack>
    {output.print_qr ? <Button onPress={() => openItem(index)}><Text>{output.item_code.trim() ? `${output.item_name} (${output.item_code})` : t('Mahsulot tanlang')}</Text></Button>
      : <VStack alignment="leading"><Text>{t('Atxot: QR chiqarilmaydi')}</Text><Text>{t('Mahsulot tanlash shart emas')}</Text></VStack>}
    <HStack><Field label={t('Qty')} value={output.qty} decimal change={value => controller.editOutput(index, { qty: value })} />
      <Field label={t('UOM')} value={output.uom} change={value => controller.editOutput(index, { uom: value })} /></HStack>
    <Field label={t('Location')} value={output.warehouse} change={value => controller.editOutput(index, { warehouse: value })} />
    <Field label={t('Bo‘lak sababi')} value={output.reason} multiline change={value => controller.editOutput(index, { reason: value })} />
  </Section>;
  if (!isCurrent()) return null;
  const notice = state.notice ? rezkaSplitNoticeText(state.notice) : null;
  return <View style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <Stack.Screen options={{ title: 'Rezka', headerLeft: () => <RoleHeaderButton icon="back" label={t('Orqaga')} onPress={onBack} tintColor={PlatformColor('label')} /> }} />
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>
      <Section><Text>{t('Mahsulotni bo‘lish')}</Text>
        <HStack><Field label="Source QR" value={state.barcode} change={value => controller.setBarcode(value)} submit={() => { void controller.loadSource(); }} />
          {scan ? <Button label={t('QR scan')} systemImage="qrcode.viewfinder" modifiers={[labelStyle('iconOnly')]} onPress={() => { void scanCode(scan); }} /> : null}</HStack>
        <Button modifiers={[buttonStyle('borderedProminent'), disabled(state.loadingSource), accessibilityIdentifier('rezka-check-source')]}
          onPress={() => { void controller.loadSource(); }}><HStack>{state.loadingSource ? <ProgressView /> : null}<Text>{t('QR ni tekshirish')}</Text></HStack></Button>
      </Section>
      <Section><Button onPress={() => { void choosePrinter(); }}><VStack alignment="leading"><Text>{t(device.title)}</Text><Text>{t(device.subtitle)}</Text></VStack></Button></Section>
      {source ? <>
        <Section><VStack alignment="leading"><Text>{source.item_name.trim() ? source.item_name : source.item_code}</Text>
          <Text>{source.item_code}</Text><Text>{`${formatRezkaQty(source.qty)} ${source.uom}`}</Text><Text>{source.warehouse}</Text></VStack></Section>
        <Section><Text>{t('Bo‘laklar')}</Text></Section>{state.outputs.map(renderOutput)}
        <Section><Button label={t('Bo‘lak qo‘shish')} systemImage="plus" onPress={() => controller.addOutput()} />
          <Field label={t('Sabab')} value={state.reason} multiline change={value => controller.setReason(value)} />
          <DisclosureGroup label={t('Printer')}>
            <Field label={t('Driver URL')} value={state.driverUrl} change={value => controller.setPrinter({ driverUrl: value })} />
            <Field label={t('Printer')} value={state.printer} change={value => controller.setPrinter({ printer: value })} />
            <Field label={t('Mode')} value={state.printMode} change={value => controller.setPrinter({ printMode: value })} />
          </DisclosureGroup>
          {!state.uncertain && !state.blockedPrinter && !device.excluded && !(state.transport === 'wifi' && isExcludedRezkaPrinter(state.printer)) ? <Button modifiers={[buttonStyle('borderedProminent'), disabled(state.submitting), accessibilityIdentifier('rezka-submit-split')]}
            onPress={() => { void controller.submit(); }}><HStack>{state.submitting ? <ProgressView /> : null}<Text>{t('Bo‘lish va QR chiqarish')}</Text></HStack></Button> : null}
        </Section>
      </> : null}
    </List></Host>
    {notice ? <PreparationNotice message={t(notice)} /> : null}
    {state.remainder ? <RemainderDialog sourceQty={state.remainder.source.qty} total={state.remainder.total} remainder={state.remainder.difference}
      uom={state.remainder.source.uom} choose={value => controller.chooseRemainder(value)} /> : null}
  </View>;
}

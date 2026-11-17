import { Button, Host, HStack, Image as SymbolImage, List, ProgressView, RNHostView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, font, foregroundStyle, frame, listStyle, onLongPressGesture, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useMemo } from 'react';
import { PlatformColor, View } from 'react-native';
import { CustomerSnackbar } from '../customer/CustomerSnackbar.ios';
import { useNativeSheet } from '../nativeSheet';
import type { ArchivePrintEntry, ArchiveSession } from './gscaleArchive';
import { materialArchiveDetails, materialArchivePrintLabel, materialArchivePrintSubtitle, materialArchiveReceiptDetails } from './gscaleMaterialPresentation';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import { useGScaleText } from './useGScaleScreen';
import { useMaterialArchiveReceipt } from './useMaterialArchiveReceipt';

type Props = { batch: ArchiveSession; operator: GScaleOperatorStore; isCurrent(): boolean; close(): void };
const ignoreSnackbarDismiss = () => {};

function Detail({ label, value }: { label: string; value: string }) {
  const t = useGScaleText();
  return <HStack alignment="top" spacing={12} modifiers={[frame({ minHeight: 32, maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel')),
      frame({ width: 112, alignment: 'leading' })]}>{t(label)}</Text>
    <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), textSelection(true)]}>{value.trim() || '-'}</Text>
  </HStack>;
}

/** @v2 RpsQrReprintSheet: archive receipt caller supplies no edit/delete/payload-tap actions. */
export function MaterialArchiveReceipt({ batch, entry, operator, isCurrent, close }: Props & { entry: ArchivePrintEntry }) {
  const model = useMaterialArchiveReceipt(entry, operator, isCurrent), t = useGScaleText();
  const qr = useMemo(() => {
    try { const value = qrFactory(0, 'M'); value.addData(entry.epc); value.make(); return value.createDataURL(5, 20); }
    catch { return ''; }
  }, [entry.epc]);
  if (!isCurrent()) return null;
  return <View style={{ flex: 1 }}><Host style={{ flex: 1 }}><VStack spacing={0}>
    <List modifiers={[listStyle('insetGrouped')]}>
      <Section><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{t('Chop etilgan QR')}</Text>
        {!!qr && <RNHostView matchContents><Image source={{ uri: qr }} style={{ width: 240, height: 240,
          alignSelf: 'center', backgroundColor: 'white', borderRadius: 18 }} contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} /></RNHostView>}
        <Text modifiers={[font({ textStyle: 'headline' })]}>{entry.item_name.trim() || batch.item_name || batch.item_code}</Text>
        <Text modifiers={[textSelection(true)]}>{entry.epc}</Text>
      </Section>
      <Section>{materialArchiveReceiptDetails(batch, entry).map(([label, value]) => <Detail key={label} label={label} value={value} />)}</Section>
      {!!model.error && <Section><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(model.error)}</Text></Section>}
      <Section><Button modifiers={[disabled(model.printing), buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 50 })]}
        onPress={() => { void model.reprint(); }}><HStack spacing={10}>
          {model.printing ? <ProgressView /> : <SymbolImage systemName="printer" size={21} />}
          <Text>{t(model.printing ? 'Chop etilmoqda…' : 'Qayta chop etish')}</Text>
        </HStack></Button>
        <Button label={t('Yopish')} modifiers={[disabled(model.printing), controlSize('large'), frame({ minHeight: 48 })]} onPress={close} />
      </Section>
    </List>
  </VStack></Host><CustomerSnackbar message={model.success ? t(model.success) : ''} messageId={null} onDismiss={ignoreSnackbarDismiss} /></View>;
}

/** @v2 _ArchiveSessionDetailsSheet */
export function MaterialArchiveDetails({ batch, operator, isCurrent, close }: Props) {
  const receiptSheet = useNativeSheet(), t = useGScaleText();
  const openReceipt = (entry: ArchivePrintEntry) => {
    if (!isCurrent() || !entry.epc.trim()) return;
    receiptSheet.open(<MaterialArchiveReceipt batch={batch} entry={entry} operator={operator} isCurrent={isCurrent} close={receiptSheet.close} />,
      { dismissible: true, heightFraction: 0.86 });
  };
  if (!isCurrent()) return null;
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>
    <Section><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{batch.item_name || batch.item_code}</Text>
      <Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel'))]}>{t('Batch to‘liq ma’lumotlari')}</Text>
    </Section>
    <Section>{materialArchiveDetails(batch).map(([label, value]) => <Detail key={label} label={label} value={value} />)}</Section>
    <Section title={t('QR / printlar')}>
      {!batch.prints.length && <Text>{t("Print tarixi hali yo'q.")}</Text>}
      {batch.prints.map((entry, index) => <Button key={`${entry.epc}:${index}`} modifiers={[disabled(!entry.epc.trim()),
        controlSize('large'), frame({ minHeight: 56 }), onLongPressGesture(() => openReceipt(entry))]} onPress={() => openReceipt(entry)}>
        <HStack spacing={12}><SymbolImage systemName="checklist" size={22} />
          <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{materialArchivePrintLabel(entry)}</Text>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{materialArchivePrintSubtitle(entry)}</Text>
          </VStack><SymbolImage systemName="qrcode" size={23} modifiers={[accessibilityLabel(t('Receipt QR ochish'))]} />
        </HStack>
      </Button>)}
    </Section>
    <Section><Button label={t('Yopish')} modifiers={[controlSize('large'), frame({ minHeight: 48 })]} onPress={close} /></Section>
  </List></Host>;
}

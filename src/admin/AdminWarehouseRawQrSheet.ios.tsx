import { BottomSheet, Button, Group, HStack, Image, ProgressView, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, controlSize, disabled, font, foregroundStyle, frame, padding, presentationDragIndicator, textSelection } from '@expo/ui/swift-ui/modifiers';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.ios';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import { AdminWarehouseRawQrPreview } from './AdminWarehouseRawQrPreview';
import { dartTrim } from './dartJsonString';
import type { AdminWarehouseRawQrProviderModel } from './useAdminWarehouseRawQrProvider';

/** Render this directly INSIDE the existing SwiftUI details-sheet Group, so UIKit has the correct presenter. */
export function AdminWarehouseRawQrNativeSheet({ model }: { model: AdminWarehouseRawQrProviderModel }) {
  const value = model.presentation, { height: viewportHeight } = useWindowDimensions(), insets = useSafeAreaInsets();
  if (!model.active || !value || !model.preview) return null;
  return <BottomSheet key={value.id} isPresented={!value.closing} fitToContents onIsPresentedChange={visible => { if (!visible) model.beginDismiss(); }} onDismiss={model.close}>
    <Group modifiers={[presentationDragIndicator('visible')]}><RNHostView matchContents={{ vertical: true }}><View>
      <ScrollView style={{ maxHeight: viewportHeight - insets.top, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
        <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><HStack modifiers={[frame({ maxWidth: Infinity }), padding({ bottom: 16 })]}><Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' })]}>Chop etilgan QR</Text><Spacer />
          <Button onPress={model.closeButton} modifiers={[buttonStyle('plain'), disabled(value.printing), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel('Yopish'), accessibilityIdentifier('warehouse-raw-qr-close')]}><Image systemName="xmark" /></Button>
        </HStack></BaseHost>
        <AdminWarehouseRawQrPreview preview={model.preview} barcode={value.stock.barcode} />
        <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' }), padding({ top: 16, bottom: 4 })]}>{dartTrim(value.stock.item_name) || dartTrim(value.stock.item_code)}</Text>
          <Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), textSelection(true), padding({ bottom: 16 })]}>{value.stock.barcode}</Text>
          {model.details.map((line, index) => <HStack key={index} alignment="top" spacing={0} modifiers={[padding({ bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), frame({ width: 72, alignment: 'leading' })]}>{line.label}</Text><Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{adminWarehouseMainDetailValue(line.value)}</Text>
          </HStack>)}
          {model.error ? <Text modifiers={[foregroundStyle('red'), font({ textStyle: 'body', weight: 'semibold' }), padding({ top: 12 })]}>{model.error}</Text> : null}
          <Button onPress={model.reprint} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(value.printing), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ top: 20 }), accessibilityIdentifier('raw-stock-qr-reprint')]}>
            <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>{value.printing ? <ProgressView /> : <Image systemName="printer" />}<Text>{model.buttonLabel}</Text></HStack>
          </Button>
        </VStack></BaseHost>
      </ScrollView>
      {value.notice ? <PreparationNotice key={value.notice} message="Mavjud QR qayta chop etildi" /> : null}
    </View></RNHostView></Group>
  </BottomSheet>;
}
/** First-sheet host. Nested Main integration uses AdminWarehouseRawQrNativeSheet instead. */
export function AdminWarehouseRawQrSheet({ model }: { model: AdminWarehouseRawQrProviderModel }) {
  return <BaseHost style={styles.host}><AdminWarehouseRawQrNativeSheet model={model} /></BaseHost>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, fullWidth: { width: '100%' } });

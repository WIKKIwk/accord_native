import { BottomSheet, Button, Group, HStack, Image, ProgressView, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, font, foregroundStyle, frame, labelStyle, multilineTextAlignment,
  presentationBackground, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Platform, PlatformColor, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import { WorkerQrScannerPreview } from './WorkerQrScannerPreview';
import { WorkerQrScannerDialogs } from './WorkerQrScannerDialogs';
import type { WorkerQrScannerModel } from './useWorkerQrScanner';

export function WorkerQrScannerView({ model }: { model: WorkerQrScannerModel }) {
  const { width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const { labels, camera } = model;
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  const background = PlatformColor('systemGroupedBackground');
  const torch = <BaseHost matchContents><Button systemImage={camera.torch ? 'bolt.fill' : 'bolt.slash'} label={labels.flash}
    onPress={camera.toggleTorch} modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), controlSize('large'), labelStyle('iconOnly'),
      accessibilityLabel(labels.flash), frame({ minWidth: 44, minHeight: 44 }), foregroundStyle(PlatformColor('label'))]} /></BaseHost>;
  return <BaseHost style={{ position: 'absolute', width }}>
    <BottomSheet isPresented={!model.closing} onIsPresentedChange={value => { if (!value) model.close(); }} onDismiss={model.dismissed}>
      <Group modifiers={[presentationDetents([{ fraction: 0.86 }]), presentationDragIndicator('visible'), presentationBackground(background)]}>
        <RNHostView><View style={{ height: 0, flexGrow: 1, backgroundColor: background }}>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><HStack spacing={12}>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{labels.title}</Text>
              <Button label={labels.close} systemImage="xmark" onPress={model.close}
                modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), controlSize('large'), labelStyle('iconOnly'),
                  accessibilityLabel(labels.close), frame({ minWidth: 44, minHeight: 44 })]} />
            </HStack></BaseHost>
            <WorkerQrScannerPreview camera={camera} torch={torch} />
            <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack spacing={16} modifiers={[frame({ maxWidth: Infinity })]}>
              <HStack spacing={10}>{model.busy ? <ProgressView /> : null}
                <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel')), multilineTextAlignment('center'), frame({ maxWidth: Infinity })]}>{labels.status}</Text>
              </HStack>
              {camera.unavailable && <Button label={labels.retry} systemImage="arrow.clockwise" onPress={() => { void camera.retry(); }}
                modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 52 }), disabled(model.busy)]} />}
              <Button onPress={model.openManual} modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), controlSize('large'), disabled(model.busy || model.closing)]}>
                <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, minHeight: 44 })]}><Image systemName="keyboard" /><Text>{labels.manual}</Text></HStack>
              </Button>
            </VStack></BaseHost>
          </ScrollView>
          <WorkerQrScannerDialogs model={model} />
        </View></RNHostView>
      </Group>
    </BottomSheet>
  </BaseHost>;
}

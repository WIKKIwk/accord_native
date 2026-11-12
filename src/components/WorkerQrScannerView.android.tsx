import { Button, CircularProgressIndicator, Column, FilledTonalButton, FilledTonalIconButton, Icon, ModalBottomSheet, RNHostView, Row, Text,
  useMaterialColors, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height as fixedHeight, semantics, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useEffectEvent, useRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import { WorkerQrScannerPreview } from './WorkerQrScannerPreview';
import { WorkerQrScannerDialogs } from './WorkerQrScannerDialogs';
import type { WorkerQrScannerModel } from './useWorkerQrScanner';

export function WorkerQrScannerView({ model }: { model: WorkerQrScannerModel }) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  const sheet = useRef<ModalBottomSheetRef>(null), dismissed = useEffectEvent(model.dismissed);
  const { labels, camera, closing } = model;
  useEffect(() => {
    if (!closing) return;
    let attached = true;
    void sheet.current?.hide().then(() => { if (attached) dismissed(); }, () => {
      // A gesture may already have removed the native dialog; its dismissal event owns the result.
    });
    return () => { attached = false; };
  }, [closing]);
  const torch = <BaseHost dynamicColors matchContents><FilledTonalIconButton onClick={camera.toggleTorch}
    modifiers={[size(48, 48), semantics({ contentDescription: labels.flash })]}><RNHostView matchContents>
      <SymbolView name={{ android: camera.torch ? 'flash_on' : 'flash_off' }} size={24} tintColor={colors.onSecondaryContainer} />
    </RNHostView></FilledTonalIconButton></BaseHost>;
  return <BaseHost dynamicColors style={{ position: 'absolute', top: 0, bottom: 0, width }}>
    <ModalBottomSheet ref={sheet} onDismissRequest={model.dismissed} skipPartiallyExpanded showDragHandle
      containerColor={colors.surfaceContainerLow} contentColor={colors.onSurface}>
      <RNHostView matchContents><View style={{ width: Math.min(width, 640), maxHeight: (height - insets.top) * 0.86 }}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 20, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <BaseHost dynamicColors matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Text style={{ typography: 'titleLarge', fontWeight: '700' }} modifiers={[weight(1)]}>{labels.title}</Text>
            <FilledTonalIconButton onClick={model.close} modifiers={[size(48, 48), semantics({ contentDescription: labels.close })]}>
              <Icon source={require('../../assets/icons/gscale/close.xml')} size={24} tint={colors.onSecondaryContainer} />
            </FilledTonalIconButton>
          </Row></BaseHost>
          <WorkerQrScannerPreview camera={camera} torch={torch} />
          <BaseHost dynamicColors matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
              {model.busy ? <CircularProgressIndicator modifiers={[size(20, 20)]} /> : null}
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{labels.status}</Text>
            </Row>
            {camera.unavailable && <Button enabled={!model.busy} onClick={() => { void camera.retry(); }} modifiers={[fillMaxWidth(), fixedHeight(52)]}><Text>{labels.retry}</Text></Button>}
            <FilledTonalButton enabled={!model.busy && !closing} onClick={model.openManual} modifiers={[fillMaxWidth(), fixedHeight(56)]}>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }}><RNHostView matchContents>
                <SymbolView name={{ android: 'keyboard' }} size={22} tintColor={colors.onSecondaryContainer} />
              </RNHostView><Text>{labels.manual}</Text></Row>
            </FilledTonalButton>
          </Column></BaseHost>
        </ScrollView>
        <WorkerQrScannerDialogs model={model} />
      </View></RNHostView>
    </ModalBottomSheet>
  </BaseHost>;
}

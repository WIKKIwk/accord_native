import { Button, CircularProgressIndicator, Column, IconButton, ModalBottomSheet, RNHostView, Row, Shape, SnackbarHost, Spacer, Text, type ModalBottomSheetRef, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { clip, fillMaxWidth, height, padding, semantics, Shapes, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import { AdminWarehouseRawQrPreview } from './AdminWarehouseRawQrPreview';
import { dartTrim } from './dartJsonString';
import type { AdminWarehouseRawQrProviderModel } from './useAdminWarehouseRawQrProvider';

/** Direct native child for an existing Compose Host/details sheet. */
export function AdminWarehouseRawQrNativeSheet({ model }: { model: AdminWarehouseRawQrProviderModel }) {
  const { colors } = useBaseTheme(), { height: viewportHeight } = useWindowDimensions(), insets = useSafeAreaInsets(), snackbar = useRef<SnackbarHostRef>(null), sheet = useRef<ModalBottomSheetRef>(null), shown = useRef<number | null>(null), hiding = useRef<number | null>(null), value = model.presentation, close = model.close;
  useEffect(() => { if (value?.notice && value.notice !== shown.current) { shown.current = value.notice; void snackbar.current?.showSnackbar({ message: 'Mavjud QR qayta chop etildi', duration: 'short' }); } }, [value?.notice]);
  useEffect(() => { if (!value?.closing || hiding.current === value.id) return; hiding.current = value.id;
    void (async () => { try { await sheet.current?.hide(); } finally { close(); } })().catch(() => {});
  }, [value?.closing, value?.id, close]);
  if (!model.active || !value || !model.preview) return null;
  const itemName = dartTrim(value.stock.item_name) || dartTrim(value.stock.item_code);
  return <ModalBottomSheet key={value.id} ref={sheet} showDragHandle={false} skipPartiallyExpanded initialFullyExpanded containerColor={colors.surfaceContainer} scrimColor="rgba(0,0,0,.32)" onDismissRequest={model.close}
    modifiers={[clip(Shapes.RoundedCorner({ topStart: 32, topEnd: 32, bottomStart: 0, bottomEnd: 0 }))]}>
    <RNHostView matchContents><View><ScrollView style={{ maxHeight: viewportHeight - insets.top, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><RNHostView matchContents><View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: colors.outlineVariant }} /></RNHostView></Column><Spacer modifiers={[height(10)]} />
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ fontSize: 20, fontWeight: '800' }} modifiers={[weight(1)]}>Chop etilgan QR</Text>
          <IconButton enabled={!value.printing} onClick={model.closeButton} modifiers={[size(48, 48), semantics({ contentDescription: 'Yopish' }), testID('warehouse-raw-qr-close')]}><RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton>
        </Row><Spacer modifiers={[height(16)]} />
      </Column></BaseHost>
      <AdminWarehouseRawQrPreview preview={model.preview} barcode={value.stock.barcode} />
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]} horizontalAlignment="center"><Spacer modifiers={[height(16)]} />
        <Text style={{ typography: 'titleMedium', fontWeight: '800', textAlign: 'center' }}>{itemName}</Text><Spacer modifiers={[height(4)]} />
        <RNHostView matchContents><NativeText selectable style={{ color: colors.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: .7, textAlign: 'center' }}>{value.stock.barcode}</NativeText></RNHostView><Spacer modifiers={[height(16)]} />
        {model.details.map((line, index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[width(72)]}>{line.label}</Text><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{adminWarehouseMainDetailValue(line.value)}</Text>
        </Row>)}
        {model.error ? <><Spacer modifiers={[height(12)]} /><Text color={colors.error} style={{ typography: 'bodyMedium', fontWeight: '600', textAlign: 'center' }}>{model.error}</Text></> : null}
        <Spacer modifiers={[height(20)]} /><Button enabled={!value.printing} onClick={model.reprint} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 } })} modifiers={[fillMaxWidth(), height(56), testID('raw-stock-qr-reprint')]}>
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{value.printing ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <RNHostView matchContents><SymbolView name={{ android: 'print' }} size={18} tintColor={colors.onPrimary} /></RNHostView>}<Text style={{ fontSize: 16, fontWeight: '500' }}>{model.buttonLabel}</Text></Row>
        </Button>
      </Column></BaseHost>
    </ScrollView><BaseHost matchContents={{ vertical: true }} style={{ position: 'absolute', left: 0, right: 0, bottom: 8 }}><SnackbarHost ref={snackbar} /></BaseHost></View></RNHostView>
  </ModalBottomSheet>;
}
/** @v2 _RawMaterialStockQrSheet + RpsQrReprintSheet */
export function AdminWarehouseRawQrSheet({ model }: { model: AdminWarehouseRawQrProviderModel }) {
  return <BaseHost style={styles.host}><AdminWarehouseRawQrNativeSheet model={model} /></BaseHost>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, fullWidth: { width: '100%' } });

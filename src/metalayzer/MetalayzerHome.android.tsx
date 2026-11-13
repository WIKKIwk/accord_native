import { Button, CircularProgressIndicator, Host, IconButton, OutlinedTextField, RNHostView, Row, Shape, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { MetalayzerFrame } from './MetalayzerFrame.android';
import { MetalayzerScanner } from './MetalayzerScanner.android';
import { useMetalayzerContext } from './MetalayzerContext';
import { formatMetalayzerQuantity, useMetalayzerLogic } from './useMetalayzerLogic';

// @v2 MetalayzerScreen
export function MetalayzerHome() {
  const h = useMetalayzerLogic(), { isCurrent } = useMetalayzerContext(), colors = useMaterialColors();
  const [scanning, setScanning] = useState(false), barcode = useNativeState(h.barcode);
  useEffect(() => { if (barcode.get() !== h.barcode) barcode.set(h.barcode); }, [barcode, h.barcode]);
  const material = h.material, next = material?.isMetalayzer === true;
  const scan = () => { if (h.startScan()) setScanning(true); };
  return <MetalayzerFrame title="Metalayzer" busy={h.busy}>
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: colors.onSurface, marginBottom: 4 }}>Xomashyoni skan qiling yoki QR kodini kiriting.</Text>
      <WorkerSheetButton label={next ? 'Keyingi xomashyoni skan qilish' : 'Xomashyoni skan qilish'} icon={{ android: 'qr_code_scanner' }}
        variant={!material || next ? 'filled' : 'outlined'} height={52} disabled={!h.enabled} onPress={scan} />
      <Host matchContents={{ vertical: true }}><OutlinedTextField value={barcode} onValueChange={h.setBarcode} enabled={h.enabled} singleLine
        isError={h.inputError !== null} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 } })}
        keyboardOptions={{ imeAction: 'search' }} keyboardActions={{ onSearch: () => { void h.lookup(); } }} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><ComposeText>Xomashyo QR kodi</ComposeText></OutlinedTextField.Label>
        <OutlinedTextField.TrailingIcon><IconButton enabled={h.enabled} onClick={() => { void h.lookup(); }}
          modifiers={[semantics({ contentDescription: 'Tekshirish' }), testID('metalayzer-lookup')]}><RNHostView matchContents>
          <SymbolView name={{ android: 'arrow_forward' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></OutlinedTextField.TrailingIcon>
      </OutlinedTextField></Host>
      {h.inputError && <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{h.inputError}</Text>}
      {h.error && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, marginTop: 4 }}>{h.error}</Text>}
      {material && <><View style={{ backgroundColor: colors.surfaceContainerHigh, borderRadius: 16, padding: 16, marginTop: 8, gap: 12 }}>
        <Text style={{ color: colors.onSurface, fontSize: 22 }}>{material.itemName || material.itemCode}</Text>
        <View style={{ alignSelf: 'flex-start', borderRadius: 20, backgroundColor: colors.secondaryContainer, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.onSecondaryContainer }}>{next ? 'Metalayzer bo‘ldi' : 'Metalayzer bo‘lmagan'}</Text></View>
        <Info label="QR kod" value={material.barcode} /><Info label="Ombor" value={material.warehouse} />
        <Info label="Miqdor" value={formatMetalayzerQuantity(material.qty, material.uom)} />
      </View><Host matchContents={{ vertical: true }}><Button enabled={h.enabled && !next} onClick={h.complete}
        modifiers={[fillMaxWidth(), height(52), testID('metalayzer-complete')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          {h.saving ? <CircularProgressIndicator modifiers={[size(24, 24)]} /> : <RNHostView matchContents><SymbolView
            name={{ android: next ? 'check_circle' : 'check_circle_outline' }} size={24} tintColor={h.enabled && !next ? colors.onPrimary : colors.onSurfaceVariant} /></RNHostView>}
          <ComposeText>Metalayzer bo‘ldi</ComposeText>
        </Row></Button></Host></>}
    </ScrollView>
    <MetalayzerScanner visible={scanning} isCurrent={isCurrent} onClose={() => { setScanning(false); void h.lookupScanned(null); }}
      onComplete={code => { setScanning(false); void h.lookupScanned(code); }} />
  </MetalayzerFrame>;
}
function Info({ label, value }: { label: string; value: string }) {
  const colors = useMaterialColors();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: colors.onSurfaceVariant }}>{label}</Text>
    <Text selectable style={{ color: colors.onSurface, flexShrink: 1, textAlign: 'right' }}>{value}</Text></View>;
}

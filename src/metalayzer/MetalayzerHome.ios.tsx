import { Button, Host, HStack, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { autocorrectionDisabled, buttonStyle, disabled, listStyle, onSubmit, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useMetalayzerContext } from './MetalayzerContext';
import { MetalayzerScanner } from './MetalayzerScanner';
import { formatMetalayzerQuantity, useMetalayzerLogic } from './useMetalayzerLogic';

/** @v2 MetalayzerScreen */
export function MetalayzerHome() {
  const model = useMetalayzerLogic(), { isCurrent } = useMetalayzerContext();
  const barcodeField = useNativeState(''), lastInput = useRef(''), [scanning, setScanning] = useState(false);
  const material = model.material;
  // Only write programmatic normalization, never echo ordinary asynchronous typing back into SwiftUI.
  useEffect(() => {
    if (model.busy && model.barcode !== lastInput.current) {
      lastInput.current = model.barcode; barcodeField.set(model.barcode);
    }
  }, [barcodeField, model.barcode, model.busy]);
  const scan = () => { if (model.startScan()) setScanning(true); };
  const finishScan = (value: string | null) => {
    setScanning(false);
    if (value !== null) { lastInput.current = value; barcodeField.set(value); }
    model.lookupScanned(value);
  };
  return <><Stack.Screen options={{ title: 'Metalayzer' }} />
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('plain')]}>
      <Section><Text>Xomashyoni skan qiling yoki QR kodini kiriting.</Text>
        <Button label={material?.isMetalayzer ? 'Keyingi xomashyoni skan qilish' : 'Xomashyoni skan qilish'}
          systemImage="qrcode.viewfinder" onPress={scan}
          modifiers={[buttonStyle(material && !material.isMetalayzer ? 'bordered' : 'borderedProminent'), disabled(!model.enabled)]} />
        <Button label="Metallangan xomashyolar" systemImage="list.bullet" onPress={() => router.push('/ios-metalayzer/materials' as Href)}
          modifiers={[buttonStyle('bordered'), disabled(!model.enabled)]} />
        <HStack><TextField text={barcodeField} placeholder="Xomashyo QR kodi" onTextChange={value => {
          if (value === lastInput.current) return;
          lastInput.current = value; model.setBarcode(value);
        }} modifiers={[disabled(!model.enabled), autocorrectionDisabled(), submitLabel('search'), onSubmit(model.lookup)]} />
          <Button label="Tekshirish" systemImage="arrow.right" onPress={model.lookup} modifiers={[disabled(!model.enabled)]} /></HStack>
        {!!model.inputError && <Text>{model.inputError}</Text>}
        {!!model.error && <Text>{model.error}</Text>}
        {model.busy && <ProgressView />}
      </Section>
      {material && <><Section><VStack alignment="leading" spacing={12}>
        <Text>{material.itemName || material.itemCode}</Text>
        <Text>{material.isMetalayzer ? 'Metalayzer bo‘ldi' : 'Metalayzer bo‘lmagan'}</Text>
        <Text>QR kod: {material.barcode}</Text><Text>Ombor: {material.warehouse}</Text>
        <Text>Miqdor: {formatMetalayzerQuantity(material.qty, material.uom)}</Text>
      </VStack></Section><Section><Button label="Metalayzer bo‘ldi"
        systemImage={material.isMetalayzer ? 'checkmark.circle.fill' : 'checkmark.circle'} onPress={model.complete}
        modifiers={[buttonStyle('borderedProminent'), disabled(!model.enabled || material.isMetalayzer)]} />
        {model.saving && <ProgressView />}</Section></>}
    </List></Host>
    {scanning && <MetalayzerScanner visible isCurrent={isCurrent} finish={finishScan} />}
  </>;
}

import { Button, Host, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, labelStyle, accessibilityIdentifier } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText } from '../shared/localization';
import { useQolipInspection, type QolipInspectionDialogProps } from './useQolipStorageForms';
import { useQolipText } from './useQolipText';

/** @v2 _InspectionDialog */
export function QolipInspectionDialog(props: QolipInspectionDialogProps) {
  const state = useQolipInspection(props), { locale } = useQolipText(), colors = useWorkerColors(), { height } = useWindowDimensions();
  const text = (key: string) => extensionText('qolipStorageText', key, locale);
  if (state.invalid) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={state.dismiss}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={state.dismiss} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><Text>{text('inspect')}</Text></Host>
        <ScrollView style={{ maxHeight: height * 0.5 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={12}>
          <Text>{text('inspect_hint')}</Text>
          <Button label={text('scan')} systemImage="qrcode.viewfinder" onPress={state.scan}
            modifiers={[buttonStyle('bordered'), disabled(state.scanning), accessibilityIdentifier('qolip-inspect-scan')]} />
          <Text>{`${text('found')} (${state.found.length}): ${state.found.join(', ')}`}</Text>
          <Text>{`${text('missing')} (${state.missing.length}): ${state.missing.join(', ')}`}</Text>
          <Text>{`${text('unexpected')} (${state.unexpected.length}): ${state.unexpected.join(', ')}`}</Text>
          {state.codes.map(code => <HStack key={code.key}><Text>{code.value}</Text>
            <Button label={code.value} systemImage="xmark.circle.fill" onPress={() => state.remove(code.key)}
              modifiers={[buttonStyle('borderless'), labelStyle('iconOnly'), accessibilityLabel(code.value)]} />
          </HStack>)}
        </VStack></Host></ScrollView>
        <Host matchContents={{ vertical: true }}><HStack spacing={16}>
          <Button label={text('cancel')} role="cancel" onPress={state.cancel} modifiers={[disabled(state.scanning)]} />
          <Button label={text('save')} onPress={state.save} modifiers={[buttonStyle('borderedProminent'), disabled(state.scanning), accessibilityIdentifier('qolip-inspect-save')]} />
        </HStack></Host>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  dialog: { width: '100%', maxWidth: 450, alignSelf: 'center', borderRadius: 24, padding: 24, gap: 16 },
});

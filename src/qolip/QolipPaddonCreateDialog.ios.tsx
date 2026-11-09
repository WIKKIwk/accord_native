import { Button, Host, HStack, Image, Menu, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, frame, accessibilityIdentifier } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText } from '../shared/localization';
import { useQolipPaddonCreate, type QolipPaddonCreateDialogProps } from './useQolipStorageForms';
import { useQolipText } from './useQolipText';

/** @v2 _PaddonCreateDialog */
export function QolipPaddonCreateDialog(props: QolipPaddonCreateDialogProps) {
  const state = useQolipPaddonCreate(props), { locale } = useQolipText(), colors = useWorkerColors();
  const text = (key: string) => extensionText('qolipStorageText', key, locale);
  if (state.invalid) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={state.dismiss}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={state.dismiss} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{text('create')}</Text>
          {state.warehouse !== null && <Text>{text('warehouse')}</Text>}
          <Menu label={<HStack><Text>{state.warehouse ?? text('warehouse')}</Text><Image systemName="chevron.down" /></HStack>}
            modifiers={[frame({ maxWidth: Infinity, minHeight: 44 }), accessibilityIdentifier('qolip-paddon-create-warehouse')]}>
            {state.warehouses.map((warehouse, index) => <Button key={`${warehouse}:${index}`} label={warehouse} onPress={() => state.choose(warehouse)} />)}
          </Menu>
          <Button label={text('create')} onPress={state.submit}
            modifiers={[buttonStyle('borderedProminent'), disabled(!state.canSubmit), frame({ maxWidth: Infinity }), accessibilityIdentifier('qolip-paddon-create-submit')]} />
          <Button label={text('cancel')} role="cancel" onPress={state.dismiss}
            modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity }), accessibilityIdentifier('qolip-paddon-create-cancel')]} />
        </VStack></Host>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  dialog: { width: '100%', maxWidth: 450, alignSelf: 'center', borderRadius: 24, padding: 24 },
});

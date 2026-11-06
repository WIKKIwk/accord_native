import { Button, Host, HStack, Menu, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { preparationWarehouseParent } from './preparationWarehousePresentation';
import { usePreparationText } from './PreparationUI';

export function PreparationWarehouseCreateDialog({ warehouses, selected, close, create }: {
  warehouses: string[]; selected: string | null; close: () => void; create: (name: string, parent: string) => void;
}) {
  const t = usePreparationText(), colors = useWorkerColors(), nativeName = useNativeState('');
  const [name, setName] = useState(''), [parent, setParent] = useState(() => preparationWarehouseParent(warehouses, selected));
  const submit = () => { const trimmed = name.trim(); if (trimmed && parent) create(trimmed, parent); };
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{t('Bola ombor ochish')}</Text>
          <Menu label={`${t('Ota ombor')}: ${parent ?? ''}`}>
            {warehouses.map(warehouse => <Button key={warehouse} label={warehouse} onPress={() => setParent(warehouse)} />)}
          </Menu>
          <TextField text={nativeName} autoFocus placeholder={t('Yangi ombor nomi')} onTextChange={setName} />
          <HStack><Button label={t('Bekor qilish')} role="cancel" onPress={close} />
            <Button label={t('Saqlash')} onPress={submit} /></HStack>
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: PlatformColor('systemFill') },
  dialog: { borderRadius: 20, padding: 24 },
});

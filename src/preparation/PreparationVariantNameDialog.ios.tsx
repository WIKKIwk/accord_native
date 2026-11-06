import { Button, Host, HStack, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { usePreparationText } from './PreparationUI';
import { preparationVariantNameCanSave } from './usePreparationLibrary';

export function PreparationVariantNameDialog<T>({ initial, orderScoped = false, save, finish }: {
  initial?: string; orderScoped?: boolean; save: (name: string) => Promise<T>; finish: (result: T | null) => void;
}) {
  const t = usePreparationText(), colors = useWorkerColors(), nativeValue = useNativeState(initial ?? '');
  const [value, setValue] = useState(initial ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [visible, setVisible] = useState(true), result = useRef<T | null>(null), sending = useRef(false);
  const close = () => { if (!sending.current) setVisible(false); };
  const submit = async () => {
    if (sending.current || !preparationVariantNameCanSave(value, initial)) return;
    sending.current = true; setBusy(true); setError('');
    try { result.current = await save(value); setVisible(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { sending.current = false; setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close} onDismiss={() => finish(result.current)}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (initial === undefined) close(); }} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{t(initial === undefined ? 'Shnek variantiga nom bering' : 'Nomini o‘zgartirish')}</Text>
          <TextField text={nativeValue} autoFocus maxLength={160} placeholder={t('Variant nomi')}
            modifiers={[disabled(busy)]} onTextChange={next => { setValue(next); setError(''); }} />
          {initial !== undefined && <Text>{t(orderScoped ? 'Bu nom faqat shu buyurtma uchun saqlanadi.'
            : 'Yangi nom keyingi buyurtmalarga biriktirishda olinadi.')}</Text>}
          {!!error && <Text>{error}</Text>}
          <HStack><Button label={t('Bekor qilish')} role="cancel" modifiers={[disabled(busy)]} onPress={close} />
            <Button label={t(busy ? 'Saqlanmoqda…' : 'Saqlash')}
              modifiers={[disabled(busy || !preparationVariantNameCanSave(value, initial))]} onPress={() => { void submit(); }} /></HStack>
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: PlatformColor('systemFill') },
  dialog: { borderRadius: 20, padding: 24 },
});

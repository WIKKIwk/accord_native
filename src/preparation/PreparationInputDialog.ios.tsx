import { Button, Host, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { preparationInputError } from './preparationLogic';
import { usePreparationText } from './PreparationUI';

export function PreparationInputDialog({ title, label, initial = '', emptyError, maxLength, close, save }: {
  title: string; label: string; initial?: string; emptyError?: string; maxLength?: number;
  close: () => void; save: (value: string) => void;
}) {
  const t = usePreparationText(), colors = useWorkerColors(), nativeValue = useNativeState(initial);
  const [value, setValue] = useState(initial), [error, setError] = useState<string | null>(null);
  const submit = () => {
    const issue = preparationInputError(value, { emptyError, maxLength });
    if (issue) { setError(issue); return; }
    save(value.trim());
  };
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{t(title)}</Text>
          <TextField text={nativeValue} autoFocus placeholder={t(label)} onTextChange={setValue} />
          {!!error && <Text>{t(error)}</Text>}
          <Button label={t('Saqlash')} onPress={submit} />
          <Button label={t('Bekor qilish')} role="cancel" onPress={close} />
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.32)' },
  dialog: { borderRadius: 20, padding: 24 },
});

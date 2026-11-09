import { Button, Host, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, onSubmit, submitLabel, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText } from '../shared/localization';
import { qolipErrorMessage } from './qolipErrorMessage';
import type { QolipSetNameDialogProps } from './qolipSetNameDialogProps';
import { useQolipSetName } from './useQolipSetName';
import { useQolipText } from './useQolipText';

// QolipSetNameDialog remains unwired until the sets screen is ported.
export function QolipSetNameDialog({ session, entry, close, saved }: QolipSetNameDialogProps) {
  const { locale, text } = useQolipText(), state = useQolipSetName(session, entry), colors = useWorkerColors();
  const input = useNativeState(entry.name), management = (key: string) => extensionText('qolipManagementText', key, locale);
  const dismiss = () => { if (!state.controller.getSnapshot().saving) close(); };
  const submit = () => {
    if (state.controller.getSnapshot().saving) return;
    state.controller.setName(input.get());
    void state.controller.save().then(result => { if (result) saved(result); });
  };
  const error = state.error === null ? '' : qolipErrorMessage(state.error, locale, management('rename_failed'));
  return <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable disabled={state.saving} style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{management('rename')}</Text>
          <TextField text={input} autoFocus maxLength={160} placeholder={management('name')}
            onTextChange={value => state.controller.setName(value)}
            modifiers={[disabled(state.saving), textInputAutocapitalization('sentences'), submitLabel('done'), onSubmit(submit)]} />
          {!!error && <Text>{error}</Text>}
          {state.saving ? <ProgressView /> : <Button label={text('action.save')} onPress={submit} />}
          <Button label={text('action.cancel')} role="cancel" modifiers={[disabled(state.saving)]} onPress={dismiss} />
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: PlatformColor('systemFill') },
  dialog: { borderRadius: 20, padding: 24 },
});

import { AlertDialog, CircularProgressIndicator, Column, Host, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useWindowDimensions } from 'react-native';
import { extensionText } from '../shared/localization';
import { qolipErrorMessage } from './qolipErrorMessage';
import type { QolipSetNameDialogProps } from './qolipSetNameDialogProps';
import { useQolipSetName } from './useQolipSetName';
import { useQolipText } from './useQolipText';

// QolipSetNameDialog remains unwired; Android grapheme-length limiting is an open parity item.
export function QolipSetNameDialog({ session, entry, close, saved }: QolipSetNameDialogProps) {
  const { locale, text } = useQolipText(), state = useQolipSetName(session, entry), { width, height } = useWindowDimensions();
  const input = useNativeState(entry.name), management = (key: string) => extensionText('qolipManagementText', key, locale);
  const dismiss = () => { if (!state.controller.getSnapshot().saving) close(); };
  const submit = (value = input.get()) => {
    if (state.controller.getSnapshot().saving) return;
    state.controller.setName(value);
    void state.controller.save().then(result => { if (result) saved(result); });
  };
  const error = state.error === null ? '' : qolipErrorMessage(state.error, locale, management('rename_failed'));
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={dismiss}>
      <AlertDialog.Title><Text>{management('rename')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column>
        <OutlinedTextField value={input} autoFocus singleLine enabled={!state.saving} onValueChange={value => state.controller.setName(value)}
          keyboardOptions={{ capitalization: 'sentences', imeAction: 'done' }} keyboardActions={{ onDone: submit }}
          modifiers={[fillMaxWidth(), testID('qolip-set-name-field')]}>
          <OutlinedTextField.Label><Text>{management('name')}</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        {!!error && <Text>{error}</Text>}
      </Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!state.saving} onClick={dismiss}><Text>{text('action.cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!state.saving} onClick={() => submit()} modifiers={[testID('qolip-set-name-save')]}>
        {state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Text>{text('action.save')}</Text>}
      </TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

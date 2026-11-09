import { AlertDialog, Button, Column, Host, IconButton, InputChip, OutlinedButton, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { semantics, testID, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useWindowDimensions } from 'react-native';
import { extensionText } from '../shared/localization';
import { useQolipInspection, type QolipInspectionDialogProps } from './useQolipStorageForms';
import { useQolipText } from './useQolipText';

/** @v2 _InspectionDialog */
export function QolipInspectionDialog(props: QolipInspectionDialogProps) {
  const state = useQolipInspection(props), { locale } = useQolipText(), { width, height } = useWindowDimensions();
  const text = (key: string) => extensionText('qolipStorageText', key, locale);
  if (state.invalid) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={state.dismiss}>
      <AlertDialog.Title><Text>{text('inspect')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column verticalArrangement={{ spacedBy: 12 }} modifiers={[verticalScroll()]}>
        <Text>{text('inspect_hint')}</Text>
        <OutlinedButton enabled={!state.scanning} onClick={state.scan} modifiers={[testID('qolip-inspect-scan')]}><Text>{text('scan')}</Text></OutlinedButton>
        <Text>{`${text('found')} (${state.found.length}): ${state.found.join(', ')}`}</Text>
        <Text>{`${text('missing')} (${state.missing.length}): ${state.missing.join(', ')}`}</Text>
        <Text>{`${text('unexpected')} (${state.unexpected.length}): ${state.unexpected.join(', ')}`}</Text>
        {state.codes.map(code => <InputChip key={code.key}>
          <InputChip.Label><Text>{code.value}</Text></InputChip.Label>
          <InputChip.TrailingIcon><IconButton onClick={() => state.remove(code.key)} modifiers={[semantics({ contentDescription: code.value })]}>
            <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={18} /></RNHostView>
          </IconButton></InputChip.TrailingIcon>
        </InputChip>)}
      </Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!state.scanning} onClick={state.cancel}><Text>{text('cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><Button enabled={!state.scanning} onClick={state.save} modifiers={[testID('qolip-inspect-save')]}><Text>{text('save')}</Text></Button></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

import { AlertDialog, Button, Column, DropdownMenuItem, ExposedDropdownMenu, ExposedDropdownMenuBox, Host, OutlinedButton,
  OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, menuAnchor, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { extensionText } from '../shared/localization';
import { useQolipPaddonCreate, type QolipPaddonCreateDialogProps } from './useQolipStorageForms';
import { useQolipText } from './useQolipText';

/** @v2 _PaddonCreateDialog */
export function QolipPaddonCreateDialog(props: QolipPaddonCreateDialogProps) {
  const state = useQolipPaddonCreate(props), { locale } = useQolipText(), { width, height } = useWindowDimensions();
  const value = useNativeState(state.warehouse ?? ''), [expanded, setExpanded] = useState(false);
  useEffect(() => { value.set(state.warehouse ?? ''); }, [value, state.warehouse]);
  const text = (key: string) => extensionText('qolipStorageText', key, locale);
  if (state.invalid) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={state.dismiss}>
      <AlertDialog.Title><Text>{text('create')}</Text></AlertDialog.Title>
      <AlertDialog.Text><ExposedDropdownMenuBox expanded={expanded} onExpandedChange={setExpanded}>
        <OutlinedTextField value={value} readOnly modifiers={[fillMaxWidth(), menuAnchor(), testID('qolip-paddon-create-warehouse')]}>
          <OutlinedTextField.Label><Text>{text('warehouse')}</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
          {state.warehouses.map((warehouse, index) => <DropdownMenuItem key={`${warehouse}:${index}`} onClick={() => { state.choose(warehouse); setExpanded(false); }}>
            <DropdownMenuItem.Text><Text>{warehouse}</Text></DropdownMenuItem.Text>
          </DropdownMenuItem>)}
        </ExposedDropdownMenu>
      </ExposedDropdownMenuBox></AlertDialog.Text>
      <AlertDialog.ConfirmButton><Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
        <Button enabled={state.canSubmit} onClick={state.submit} modifiers={[fillMaxWidth(), testID('qolip-paddon-create-submit')]}><Text>{text('create')}</Text></Button>
        <OutlinedButton onClick={state.dismiss} modifiers={[fillMaxWidth(), testID('qolip-paddon-create-cancel')]}><Text>{text('cancel')}</Text></OutlinedButton>
      </Column></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

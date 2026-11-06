import { AlertDialog, Column, DropdownMenu, DropdownMenuItem, Host, OutlinedButton, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { preparationWarehouseParent } from './preparationWarehousePresentation';
import { usePreparationText } from './PreparationUI.android';

export function PreparationWarehouseCreateDialog({ warehouses, selected, close, create }: {
  warehouses: string[]; selected: string | null; close: () => void; create: (name: string, parent: string) => void;
}) {
  const t = usePreparationText(), { width, height } = useWindowDimensions(), nativeName = useNativeState('');
  const [name, setName] = useState(''), [parent, setParent] = useState(() => preparationWarehouseParent(warehouses, selected));
  const [expanded, setExpanded] = useState(false);
  const submit = () => { const trimmed = name.trim(); if (trimmed && parent) create(trimmed, parent); };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close}>
      <AlertDialog.Title><Text>{t('Bola ombor ochish')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column verticalArrangement={{ spacedBy: 12 }}>
        <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
          <DropdownMenu.Trigger><OutlinedButton onClick={() => setExpanded(true)} modifiers={[fillMaxWidth(), testID('preparation-warehouse-parent')]}>
            <Text>{`${t('Ota ombor')}: ${parent ?? ''}`}</Text></OutlinedButton></DropdownMenu.Trigger>
          <DropdownMenu.Items>{warehouses.map(warehouse => <DropdownMenuItem key={warehouse} onClick={() => { setParent(warehouse); setExpanded(false); }}>
            <DropdownMenuItem.Text><Text>{warehouse}</Text></DropdownMenuItem.Text></DropdownMenuItem>)}</DropdownMenu.Items>
        </DropdownMenu>
        <OutlinedTextField value={nativeName} singleLine autoFocus onValueChange={setName}
          modifiers={[fillMaxWidth(), testID('preparation-warehouse-name')]}>
          <OutlinedTextField.Label><Text>{t('Yangi ombor nomi')}</Text></OutlinedTextField.Label>
        </OutlinedTextField>
      </Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={close}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={submit}><Text>{t('Saqlash')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

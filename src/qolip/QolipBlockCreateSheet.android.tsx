import { Button, CircularProgressIndicator, Column, DropdownMenuItem, ExposedDropdownMenu, ExposedDropdownMenuBox, Host, OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, menuAnchor, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import type { QolipBlockCreateSheetProps } from './qolipBlockCreateSheetProps';
import { useQolipBlockCreate } from './useQolipBlockCreate';
import { useQolipText } from './useQolipText';

// Content only. No Home/Add opener or route; sent-write settlement and production retry remain held.
export function QolipBlockCreateSheet(props: QolipBlockCreateSheetProps) {
  const state = useQolipBlockCreate(props), name = useNativeState(''), warehouseLabel = useNativeState(state.warehouse ?? '');
  const [expanded, setExpanded] = useState(false), { text } = useQolipText();
  if (state.invalid) return null;
  return <KeyboardAvoidingView behavior="padding"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><Column>
      <Text>{text('home.block_add_title')}</Text>
      {state.showWarehouseField && <ExposedDropdownMenuBox expanded={expanded} onExpandedChange={setExpanded} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField value={warehouseLabel} readOnly modifiers={[menuAnchor(), fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{text('blocks.warehouse')}</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
          {state.warehouses.map((warehouse, index) => <DropdownMenuItem key={`${warehouse}:${index}`} onClick={() => {
            if (!state.controller.canAct()) return;
            state.controller.setWarehouse(warehouse); warehouseLabel.set(warehouse); setExpanded(false);
          }}><DropdownMenuItem.Text><Text>{warehouse}</Text></DropdownMenuItem.Text></DropdownMenuItem>)}
        </ExposedDropdownMenu>
      </ExposedDropdownMenuBox>}
      <OutlinedTextField value={name} singleLine onValueChange={value => state.controller.setName(value)}
        keyboardOptions={{ capitalization: 'characters', imeAction: 'done' }} modifiers={[fillMaxWidth(), testID('qolip-block-create-name')]}>
        <OutlinedTextField.Label><Text>{text('blocks.name')}</Text></OutlinedTextField.Label>
      </OutlinedTextField>
      <Button enabled={state.canSave && !state.saving} onClick={() => { state.controller.setName(name.get()); state.save(); }} modifiers={[fillMaxWidth(), testID('qolip-block-create-save')]}>
        {state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Text>{text('action.save')}</Text>}
      </Button>
    </Column></Host>
  </ScrollView></KeyboardAvoidingView>;
}

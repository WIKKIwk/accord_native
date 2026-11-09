import { Button, Host, Picker, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, frame, pickerStyle, submitLabel, tag, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import type { QolipBlockCreateSheetProps } from './qolipBlockCreateSheetProps';
import { useQolipBlockCreate } from './useQolipBlockCreate';
import { useQolipText } from './useQolipText';

// Content only. No Home/Add opener or route; sent-write settlement and production retry remain held.
export function QolipBlockCreateSheet(props: QolipBlockCreateSheetProps) {
  const state = useQolipBlockCreate(props), name = useNativeState(''), { text } = useQolipText();
  if (state.invalid) return null;
  return <KeyboardAvoidingView behavior="padding"><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={14}>
      <Text>{text('home.block_add_title')}</Text>
      {state.showWarehouseField && <Picker label={text('blocks.warehouse')} selection={state.warehouse}
        onSelectionChange={value => state.controller.setWarehouse(value)} modifiers={[pickerStyle('menu'), frame({ maxWidth: Infinity })]}>
        {state.warehouses.map((warehouse, index) => <Text key={`${warehouse}:${index}`} modifiers={[tag(warehouse)]}>{warehouse}</Text>)}
      </Picker>}
      <Text>{text('blocks.name')}</Text>
      <TextField text={name} onTextChange={value => state.controller.setName(value)}
        modifiers={[textInputAutocapitalization('characters'), submitLabel('done')]} />
      <Button onPress={() => { state.controller.setName(name.get()); state.save(); }} modifiers={[buttonStyle('borderedProminent'), disabled(!state.canSave || state.saving), frame({ maxWidth: Infinity })]}>
        {state.saving ? <ProgressView /> : <Text>{text('action.save')}</Text>}
      </Button>
    </VStack></Host>
  </ScrollView></KeyboardAvoidingView>;
}

import { Host, HStack, Picker, Text, TextField, useNativeState } from '@expo/ui/swift-ui';
import { disabled as disable, frame, keyboardType, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
export function QolipFormField({ label, value, onChange, disabled = false, numeric = false }: { label: string; value: string; onChange(value: string): void; disabled?: boolean; numeric?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }}><HStack spacing={12}><Text>{label}</Text><TextField text={native} placeholder={label} onTextChange={onChange}
    modifiers={[frame({ maxWidth: Infinity }), disable(disabled), ...(numeric ? [keyboardType('numeric')] : [])]} /></HStack></Host>;
}
export function QolipFormSelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange(value: string): void; disabled?: boolean }) {
  return <Host matchContents={{ vertical: true }}><Picker label={label} selection={value} onSelectionChange={onChange} modifiers={[pickerStyle('menu'), disable(disabled)]}>
    {options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}
  </Picker></Host>;
}

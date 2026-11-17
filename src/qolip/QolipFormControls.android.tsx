import { Host, OutlinedTextField, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect } from 'react';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
export function QolipFormField({ label, value, onChange, disabled = false, numeric = false }: { label: string; value: string; onChange(value: string): void; disabled?: boolean; numeric?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }}><OutlinedTextField value={native} onValueChange={onChange} enabled={!disabled} singleLine
    keyboardOptions={{ keyboardType: numeric ? 'number' : 'text' }} modifiers={[fillMaxWidth()]}><OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label></OutlinedTextField></Host>;
}
export function QolipFormSelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange(value: string): void; disabled?: boolean }) {
  const colors = useMaterialColors();
  return <DropdownFilter label={label} selectedLabel={options.find(option => option.value === value)?.label ?? label} options={options}
    onChange={onChange} enabled={!disabled} backgroundColor={colors.surface} last />;
}

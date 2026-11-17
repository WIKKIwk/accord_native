import { Host, OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect } from 'react';
export function QolipCatalogField({ value, label, onChange, disabled, numeric = false }: { value: string; label: string; onChange(value: string): void; disabled?: boolean; numeric?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }}><OutlinedTextField value={native} singleLine enabled={!disabled}
    keyboardOptions={{ keyboardType: numeric ? 'number' : 'text' }} onValueChange={onChange} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField></Host>;
}

import { Host, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, frame, keyboardType, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
export function QolipCatalogField({ value, label, onChange, disabled: unavailable, numeric = false }: { value: string; label: string; onChange(value: string): void; disabled?: boolean; numeric?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
    <Text>{label}</Text><TextField text={native} placeholder={label} onTextChange={onChange}
      modifiers={[textFieldStyle('roundedBorder'), disabled(unavailable ?? false), ...(numeric ? [keyboardType('numeric')] : [])]} />
  </VStack></Host>;
}

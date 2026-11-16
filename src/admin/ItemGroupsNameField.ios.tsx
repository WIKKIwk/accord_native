import { Host, TextField, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, frame, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
export function ItemGroupsNameField({ label, initial, onChange, enabled }: { label: string; initial: string; onChange: (value: string) => void; enabled: boolean }) {
  const value = useNativeState(initial);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><TextField text={value} placeholder={label} onTextChange={onChange}
    modifiers={[accessibilityLabel(label), disabled(!enabled), textFieldStyle('roundedBorder'), submitLabel('next'), frame({ maxWidth: Infinity, minHeight: 56 })]} /></Host>;
}

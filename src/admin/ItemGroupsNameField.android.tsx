import { Host, OutlinedTextField, Shape, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
export function ItemGroupsNameField({ label, initial, onChange, enabled }: { label: string; initial: string; onChange: (value: string) => void; enabled: boolean }) {
  const value = useNativeState(initial);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={value} onValueChange={onChange} enabled={enabled}
    singleLine keyboardOptions={{ imeAction: 'next' }} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 12, topEnd: 12, bottomStart: 12, bottomEnd: 12 } })} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField></Host>;
}

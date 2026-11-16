import { Column, Host, Row, Switch, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, padding, toggleable, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { ItemGroupsTypeSwitchProps } from './itemGroupsControlTypes';

/** V2 SwitchListTile: the title and subtitle stay beside the native switch. */
export function ItemGroupsTypeSwitch({ label, hint, value, disabled, onChange }: ItemGroupsTypeSwitchProps) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="center" modifiers={[
    fillMaxWidth(), defaultMinSize({ minHeight: 72 }), toggleable(value, () => onChange(!value), { enabled: !disabled, role: 'switch' }),
  ]}>
    <Column modifiers={[weight(1), padding(0, 0, 16, 0)]}><Text style={{ typography: 'bodyLarge' }}>{label}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{hint}</Text></Column>
    <Switch value={value} enabled={!disabled} />
  </Row></Host>;
}

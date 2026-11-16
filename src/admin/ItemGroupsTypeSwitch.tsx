import { Host, Switch } from '@expo/ui';
import { Text, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import type { ItemGroupsTypeSwitchProps } from './itemGroupsControlTypes';

export function ItemGroupsTypeSwitch({ label, hint, value, disabled, onChange }: ItemGroupsTypeSwitchProps) {
  const colors = useWorkerColors();
  return <View><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Switch label={label} value={value} disabled={disabled} onValueChange={onChange} /></Host>
    <Text style={{ color: colors.muted }}>{hint}</Text></View>;
}

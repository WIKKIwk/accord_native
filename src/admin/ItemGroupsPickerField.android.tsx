import { Column, Host, RNHostView, Row, Shape, Surface, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ItemGroupsPickerFieldProps } from './itemGroupsControlTypes';
export function ItemGroupsPickerField({ label, value, placeholder, enabled, onPress }: ItemGroupsPickerFieldProps) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>
    <Text color={colors.onSurfaceVariant} style={{ fontSize: 12, fontWeight: '700' }}>{label}</Text>
    <Surface enabled={enabled} onClick={onPress} color={colors.surface} border={{ width: 1, color: colors.outlineVariant }} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 12, topEnd: 12, bottomStart: 12, bottomEnd: 12 } })}
      modifiers={[fillMaxWidth(), height(52)]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), height(52), padding(14, 0, 14, 0)]}>
        <Text color={value === null ? colors.onSurfaceVariant : colors.onSurface} maxLines={1} overflow="ellipsis" style={{ fontSize: 16, fontWeight: '700' }} modifiers={[weight(1)]}>{value ?? placeholder}</Text>
        <RNHostView matchContents><SymbolView name={{ android: 'expand_more' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </Row>
    </Surface>
  </Column></Host>;
}

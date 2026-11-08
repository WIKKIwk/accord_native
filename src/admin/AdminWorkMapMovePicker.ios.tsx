import { ListItem } from '@expo/ui';
import { Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, background, font } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkMapMovePickerProps } from './adminWorkMapMoveTypes';

export function AdminWorkMapMovePicker({ title, rows, onChoose }: AdminWorkMapMovePickerProps) {
  const theme = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }}><VStack alignment="leading" spacing={8}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{title}</Text>
    {rows.map(row => <ListItem key={row.key} testID={`admin-move-picker-${row.key}`} onPress={() => onChoose(row.selection)}
      modifiers={row.selected ? [background(theme.colors.primaryContainer), accessibilityAddTraits(['isSelected'])] : []}>{row.name}</ListItem>)}
  </VStack></BaseHost>;
}

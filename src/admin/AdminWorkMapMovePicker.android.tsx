import { ListItem } from '@expo/ui';
import { Column, Text } from '@expo/ui/jetpack-compose';
import { BaseHost } from '../components/BaseHost';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkMapMovePickerProps } from './adminWorkMapMoveTypes';

export function AdminWorkMapMovePicker({ title, rows, onChoose }: AdminWorkMapMovePickerProps) {
  const theme = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }}><Column>
    <Text style={{ typography: 'titleLarge' }}>{title}</Text>
    {rows.map(row => <ListItem key={row.key} testID={`admin-move-picker-${row.key}`} onPress={() => onChoose(row.selection)}
      colors={row.selected ? { containerColor: theme.colors.primaryContainer } : undefined}>{row.name}</ListItem>)}
  </Column></BaseHost>;
}

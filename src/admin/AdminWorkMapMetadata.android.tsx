import { ListItem } from '@expo/ui';
import { Column, Text } from '@expo/ui/jetpack-compose';
import type { AdminWorkMapMetadataRow } from './adminWorkMapMetadataModel';

export function AdminWorkMapMetadata({ rows }: { rows: readonly AdminWorkMapMetadataRow[] }) {
  return <Column>{rows.map(row => <ListItem key={row.id} testID={`admin-work-map-${row.id}`} supportingText={row.value}>
    <Text style={{ typography: 'bodyLarge' }}>{row.label}</Text>
  </ListItem>)}</Column>;
}

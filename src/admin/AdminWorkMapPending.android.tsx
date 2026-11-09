import { ListItem } from '@expo/ui';
import { Column, Text } from '@expo/ui/jetpack-compose';
import type { AdminWorkMapPendingRow } from './adminWorkMapPendingPresentation';
export function AdminWorkMapPending({ rows }: { rows: readonly AdminWorkMapPendingRow[] }) {
  return <Column>{rows.map(row => <ListItem key={row.id} testID={`admin-pending-${row.id}`} supportingText={row.value}><Text>{row.label}</Text></ListItem>)}</Column>;
}

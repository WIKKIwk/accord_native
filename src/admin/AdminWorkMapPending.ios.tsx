import { ListItem } from '@expo/ui';
import { Text, VStack } from '@expo/ui/swift-ui';
import type { AdminWorkMapPendingRow } from './adminWorkMapPendingPresentation';
export function AdminWorkMapPending({ rows }: { rows: readonly AdminWorkMapPendingRow[] }) {
  return <VStack>{rows.map(row => <ListItem key={row.id} testID={`admin-pending-${row.id}`} supportingText={row.value}><Text>{row.label}</Text></ListItem>)}</VStack>;
}

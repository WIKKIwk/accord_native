import { ListItem } from '@expo/ui';
import { Text, VStack } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import type { AdminWorkMapMetadataRow } from './adminWorkMapMetadataModel';

/** Passive metadata inside the detail owner's existing native Host. */
export function AdminWorkMapMetadata({ rows }: { rows: readonly AdminWorkMapMetadataRow[] }) {
  return <VStack>{rows.map(row => <ListItem key={row.id} testID={`admin-work-map-${row.id}`} supportingText={row.value}>
    <Text modifiers={[font({ textStyle: 'body' })]}>{row.label}</Text>
  </ListItem>)}</VStack>;
}

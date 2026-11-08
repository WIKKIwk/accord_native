import { ListItem } from '@expo/ui';
import { Text } from '@expo/ui/jetpack-compose';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';

/** A genuine closed summary, without exposing the unguarded history-detail operation. */
export function AdminWorkMapClosedRow({ row }: { row: Pick<ClosedRow, 'position' | 'headline' | 'supporting'> }) {
  return <ListItem supportingText={row.supporting} leading={<Text style={{ typography: 'labelMedium', fontWeight: '700' }}>{row.position}</Text>}>
    <Text style={{ typography: 'bodyLarge', fontWeight: '700' }}>{row.headline}</Text>
  </ListItem>;
}

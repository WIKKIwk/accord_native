import { ListItem } from '@expo/ui';
import { RNHostView, Text } from '@expo/ui/jetpack-compose';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';

/** A genuine closed summary, without exposing the unguarded history-detail operation. */
export function AdminWorkMapClosedRow({ row }: { row: Pick<ClosedRow, 'position' | 'headline' | 'supporting'> }) {
  return <ListItem supportingText={row.supporting} leading={<RNHostView matchContents><AdminClosedRank position={row.position} /></RNHostView>}>
    <Text style={{ typography: 'bodyLarge', fontWeight: '700' }}>{row.headline}</Text>
  </ListItem>;
}

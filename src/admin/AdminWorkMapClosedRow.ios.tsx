import { ListItem } from '@expo/ui';
import { Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';

/** History expansion stays disconnected until the protected detail reader can enforce its captured scope. */
export function AdminWorkMapClosedRow({ row }: { row: Pick<ClosedRow, 'position' | 'headline' | 'supporting'> }) {
  return <ListItem supportingText={row.supporting}
    leading={<Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{row.position}</Text>}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{row.headline}</Text>
  </ListItem>;
}

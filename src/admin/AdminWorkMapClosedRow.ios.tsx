import { HStack, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, clipShape, font, foregroundStyle, lineLimit, padding, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';

/** History expansion stays disconnected until the protected detail reader can enforce its captured scope. */
export function AdminWorkMapClosedRow({ row }: { row: Pick<ClosedRow, 'position' | 'headline' | 'supporting'> }) {
  return <HStack spacing={14} modifiers={[padding({ horizontal: 14, vertical: 8 }), background(PlatformColor('secondarySystemGroupedBackground')),
    clipShape('roundedRectangle', 12)]}>
    <RNHostView matchContents><AdminClosedRank position={row.position} /></RNHostView>
    <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), lineLimit(1), truncationMode('tail')]}>{row.headline}</Text>
      {!!row.supporting && <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')), lineLimit(2), truncationMode('tail')]}>{row.supporting}</Text>}</VStack><Spacer />
  </HStack>;
}

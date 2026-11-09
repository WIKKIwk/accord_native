import { HStack, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, clipShape, font, foregroundStyle, lineLimit, padding, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import type { AdminWorkMapMoveRow as Row } from './adminWorkMapMoveTypes';

/** Read-only source row: no order selection, drag handle, detail or transfer callback. */
export function AdminWorkMapMoveRow({ row }: { row: Row; first?: boolean; last?: boolean }) {
  return <HStack testID="admin-move-order-row" spacing={14} modifiers={[padding({ horizontal: 14, vertical: 8 }),
    background(PlatformColor('secondarySystemGroupedBackground')), clipShape('roundedRectangle', 12)]}>
    <RNHostView matchContents><AdminClosedRank position={row.position} /></RNHostView>
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={[lineLimit(1), truncationMode('tail')]}>
        {!!row.code && <Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{`${row.code} • `}</Text>}
        <Text modifiers={[font({ textStyle: 'body', weight: 'bold' })]}>{row.title}</Text>
      </Text>
      {!!row.supporting && <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')),
        lineLimit(1), truncationMode('tail')]}>{row.supporting}</Text>}
    </VStack><Spacer />
  </HStack>;
}

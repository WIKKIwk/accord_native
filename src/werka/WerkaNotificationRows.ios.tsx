import { HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { lineLimit, listRowBackground } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { orderedWerkaNotifications, werkaNotificationPresentation, type WerkaNotificationRowsProps } from './werkaNotificationPresentation';

/** Read-only rows: no unread store, clear action, detail route or subscription is connected. */
export function WerkaNotificationRows(props: WerkaNotificationRowsProps) {
  const icons = { draft: 'clock', pending: 'clock', accepted: 'checkmark.circle.fill', partial: 'checkmark', rejected: 'xmark', cancelled: 'minus' } as const;
  return <PreparationList refresh={props.onRefresh}><Section>{orderedWerkaNotifications(props.items, props.highlightedIds).map((record, index) => {
    const row = werkaNotificationPresentation(record, props.locale);
    return <VStack key={`${record.id}:${index}`} alignment="leading" spacing={3}
      modifiers={props.highlightedIds.has(record.id) ? [listRowBackground(PlatformColor('systemGray5'))] : []}>
      <HStack><Text modifiers={[lineLimit(1)]}>{row.title}</Text><Spacer /><Image systemName={icons[row.icon]} size={16} /></HStack>
      <Text modifiers={[lineLimit(1)]}>{row.secondary}</Text><HStack><Text modifiers={[lineLimit(1)]}>{row.metric}</Text><Spacer /><Text>{row.date}</Text></HStack>
    </VStack>;
  })}</Section></PreparationList>;
}

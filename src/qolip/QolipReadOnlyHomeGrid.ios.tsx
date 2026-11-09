import { Host, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, frame, lineLimit, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { qolipGridCells, qolipGridLetters, qolipGridRowCount, type QolipGridCell } from './qolipGridLogic';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { useQolipGridScroll } from './useQolipGridScroll';
import { useQolipText } from './useQolipText';

const tableHeight = 36 + 4 + qolipGridRowCount * 68, tableWidth = qolipGridLetters.length * 80 - 4;
function Cell({ cell, locale }: { cell: QolipGridCell; locale: string }) {
  const filled = cell.items.length > 0, quantity = localizedMethod('qolipQuantityShort', locale, { count: cell.quantity });
  return <VStack alignment={filled ? 'leading' : 'center'} spacing={2} modifiers={[
    frame({ width: 76, height: 64 }), background(cell.matchCount > 0 ? PlatformColor('systemGreen')
      : filled ? PlatformColor('secondarySystemFill') : PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 12 })),
    accessibilityLabel(filled ? `${cell.label}, ${cell.title}, ${quantity}` : cell.label), accessibilityIdentifier(`qolip-grid-cell-${cell.label}`),
  ]}>{filled && <><HStack><Image systemName="square.stack.3d.up.fill" size={14} />
    <Text modifiers={[lineLimit(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{cell.title}</Text>
    {cell.matchCount > 0 && <Text>{String(cell.matchCount)}</Text>}</HStack><Spacer /><Text>{quantity}</Text></>}</VStack>;
}
function GridTable({ rows, locale }: { rows: QolipGridCell[][]; locale: string }) {
  const { panHandlers, bindScroll, onScroll, onContentSizeChange, onViewportWidth } = useQolipGridScroll();
  return <View style={{ flexDirection: 'row', height: tableHeight, width: '100%' }}>
    <View {...panHandlers} style={{ width: 45, height: tableHeight }}><Host style={{ width: 42, height: tableHeight }}><VStack spacing={4}>
      <Text modifiers={[frame({ width: 42, height: 36 })]}>{' '}</Text>
      {Array.from({ length: qolipGridRowCount }, (_, index) => <Text key={index}
        modifiers={[frame({ width: 42, height: 64 }), background(PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 10 }))]}>{String(index + 1)}</Text>)}
    </VStack></Host></View>
    <ScrollView ref={bindScroll} horizontal showsHorizontalScrollIndicator onScroll={onScroll} scrollEventThrottle={16}
      onContentSizeChange={onContentSizeChange} onLayout={event => onViewportWidth(event.nativeEvent.layout.width)}>
      <Host style={{ width: tableWidth, height: tableHeight }}><VStack alignment="leading" spacing={4}>
        <HStack spacing={4}>{qolipGridLetters.map(letter => <Text key={letter} modifiers={[frame({ width: 76, height: 36 }),
          background(PlatformColor('secondarySystemFill'), shapes.roundedRectangle({ cornerRadius: 10 }))]}>{letter}</Text>)}</HStack>
        {rows.map((row, index) => <HStack key={index} spacing={4}>{row.map(cell => <Cell key={cell.label} cell={cell} locale={locale} />)}</HStack>)}
      </VStack></Host>
    </ScrollView>
  </View>;
}
export function QolipReadOnlyHomeGrid(props: { locations: readonly QolipLocationEntry[] | null; loading: boolean; error: boolean;
  refreshUnavailable?: boolean; searchCounts: Readonly<Record<string, number>> }) {
  const { text, locale } = useQolipText(), insets = useSafeAreaInsets();
  if (props.locations === null && props.loading) return <Host style={{ flex: 1 }}><ProgressView /></Host>;
  if (props.locations === null && props.error) return <Host style={{ flex: 1 }}><Text>{props.refreshUnavailable
    ? text('home.load_failed') : localizedGetter('serverDisconnectedRetry', locale)}</Text></Host>;
  const grid = qolipGridCells(props.locations ?? [], props.searchCounts);
  return <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <Host matchContents={{ vertical: true }}><HStack spacing={8}><Text>{text('home.occupied_count', { count: grid.occupiedCells })}</Text>
      <Text>{text('home.mold_count_stat', { count: grid.totalQuantity })}</Text>
      {grid.unplaced.length > 0 && <Text>{text('home.unplaced_count', { count: grid.unplaced.length })}</Text>}</HStack></Host>
    <GridTable rows={grid.rows} locale={locale} />
    {grid.occupiedCells === 0 && grid.unplaced.length === 0 && <Host matchContents><Text>{text('home.no_molds')}</Text></Host>}
    {grid.unplaced.length > 0 && <Host matchContents={{ vertical: true }}><VStack alignment="leading"><Text>{text('home.unplaced')}</Text>
      {grid.unplaced.map((item, index) => <HStack key={`${item.id}:${index}`}><Image systemName="scissors" /><VStack alignment="leading">
        <Text modifiers={[lineLimit(1)]}>{item.item_name}</Text>
        <Text modifiers={[lineLimit(1)]}>{`${item.qolip_code} • ${item.size} • ${localizedMethod('qolipCount', locale, { count: item.quantity })}`}</Text>
      </VStack></HStack>)}
    </VStack></Host>}
  </ScrollView>;
}

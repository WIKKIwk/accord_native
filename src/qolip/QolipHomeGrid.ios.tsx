import { Button, Host, HStack, Image, ProgressView, RNHostView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, contentShape, frame, lineLimit, onLongPressGesture, onTapGesture, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { qolipGridCells, qolipGridLetters, qolipGridRowCount, type QolipGridCell } from './qolipGridLogic';
import type { QolipHomeGridProps } from './qolipHomeGridProps';
import { useQolipGridScroll } from './useQolipGridScroll';
import { useQolipText } from './useQolipText';

const tableHeight = 36 + 4 + qolipGridRowCount * 68;
const tableWidth = qolipGridLetters.length * 80 - 4;
function Cell({ cell, locale, open, print }: { cell: QolipGridCell; locale: string; open: () => void; print: () => void }) {
  const filled = cell.items.length > 0, quantity = localizedMethod('qolipQuantityShort', locale, { count: cell.quantity });
  return <VStack alignment={filled ? 'leading' : 'center'} spacing={2} modifiers={[
    frame({ width: 76, height: 64 }), background(cell.matchCount > 0 ? PlatformColor('systemGreen')
      : filled ? PlatformColor('secondarySystemFill') : PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 12 })),
    contentShape(shapes.rectangle()), accessibilityLabel(filled ? `${cell.label}, ${cell.title}, ${quantity}` : cell.label),
    accessibilityIdentifier(`qolip-grid-cell-${cell.label}`), onTapGesture(open), onLongPressGesture(print),
  ]}>
    {filled ? <><HStack><Image systemName="square.stack.3d.up.fill" size={14} /><Text modifiers={[lineLimit(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{cell.title}</Text>
      {cell.matchCount > 0 && <Text>{String(cell.matchCount)}</Text>}</HStack><Spacer /><Text>{quantity}</Text></>
      : <Image systemName="plus.square" />}
  </VStack>;
}
function GridTable({ rows, locale, openCell, printCell }: Pick<QolipHomeGridProps, 'openCell' | 'printCell'> & {
  rows: QolipGridCell[][]; locale: string;
}) {
  const { panHandlers, bindScroll, onScroll, onContentSizeChange, onViewportWidth } = useQolipGridScroll();
  return <View style={{ flexDirection: 'row', height: tableHeight, width: '100%' }}>
    <View {...panHandlers} style={{ width: 45, height: tableHeight }}>
      <Host style={{ width: 42, height: tableHeight }}><VStack spacing={4}>
        <Text modifiers={[frame({ width: 42, height: 36 })]}>{' '}</Text>
        {Array.from({ length: qolipGridRowCount }, (_, index) => <Text key={index}
          modifiers={[frame({ width: 42, height: 64 }), background(PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 10 }))]}>{String(index + 1)}</Text>)}
      </VStack></Host>
    </View>
    <ScrollView ref={bindScroll} horizontal showsHorizontalScrollIndicator onScroll={onScroll} scrollEventThrottle={16}
      onContentSizeChange={onContentSizeChange} onLayout={event => onViewportWidth(event.nativeEvent.layout.width)}>
      <Host style={{ width: tableWidth, height: tableHeight }}><VStack alignment="leading" spacing={4}>
        <HStack spacing={4}>{qolipGridLetters.map(letter => <Text key={letter} modifiers={[frame({ width: 76, height: 36 }),
          background(PlatformColor('secondarySystemFill'), shapes.roundedRectangle({ cornerRadius: 10 }))]}>{letter}</Text>)}</HStack>
        {rows.map((row, index) => <HStack key={index} spacing={4}>{row.map(cell => <Cell key={cell.label} cell={cell} locale={locale}
          open={() => openCell(cell.letter, cell.row, cell.items)} print={() => printCell(cell.letter, cell.row)} />)}</HStack>)}
      </VStack></Host>
    </ScrollView>
  </View>;
}

// The parent must supply real cell and printer actions; the home route is not wired yet.
export function QolipHomeGrid(props: QolipHomeGridProps) {
  const { text, locale } = useQolipText(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const insets = useSafeAreaInsets();
  if (props.locations === null && props.loading) return <Host style={{ flex: 1 }}><ProgressView /></Host>;
  if (props.locations === null && props.error) return <Host style={{ flex: 1 }}><VStack>
    <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><Button label={localizedGetter('retry', locale)}
      onPress={() => { void props.refresh(); }} />
  </VStack></Host>;
  const grid = qolipGridCells(props.locations ?? [], props.searchCounts);
  return <Host style={{ flex: 1 }}><OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={props.refresh}>
    <Section><RNHostView matchContents={{ vertical: true }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Host matchContents><Text>{text('home.occupied_count', { count: grid.occupiedCells })}</Text></Host>
      <Host matchContents><Text>{text('home.mold_count_stat', { count: grid.totalQuantity })}</Text></Host>
      {grid.unplaced.length > 0 && <Host matchContents><Text>{text('home.unplaced_count', { count: grid.unplaced.length })}</Text></Host>}
    </View></RNHostView></Section>
    <Section><RNHostView matchContents={{ vertical: true }}><GridTable rows={grid.rows} locale={locale} openCell={props.openCell} printCell={props.printCell} /></RNHostView></Section>
    {grid.occupiedCells === 0 && grid.unplaced.length === 0 && <Section><VStack><Text>{text('home.no_molds')}</Text><Text>{text('home.attach_hint')}</Text></VStack></Section>}
    {grid.unplaced.length > 0 && <Section><Text>{text('home.unplaced')}</Text>{grid.unplaced.map((item, index) => <HStack key={`${item.id}:${index}`}>
      <Image systemName="scissors" /><VStack alignment="leading"><Text modifiers={[lineLimit(1)]}>{item.item_name}</Text>
        <Text modifiers={[lineLimit(1)]}>{`${item.qolip_code} • ${item.size} • ${localizedMethod('qolipCount', locale, { count: item.quantity })}`}</Text></VStack>
    </HStack>)}</Section>}
    <RNHostView matchContents><View style={{ height: 320 + insets.bottom }} /></RNHostView>
  </OrdersList></Host>;
}

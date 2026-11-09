import { Box, Column, FlowRow, Host, Icon, RNHostView, Row, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, combinedClickable, paddingAll, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { ActivityIndicator, ScrollView, Text as NativeText, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { qolipGridCells, qolipGridLetters, qolipGridMatchBackground, qolipGridRowCount, type QolipGridCell } from './qolipGridLogic';
import type { QolipHomeGridProps } from './qolipHomeGridProps';
import { useQolipGridScroll } from './useQolipGridScroll';
import { useQolipText } from './useQolipText';

const addIcon = require('../../assets/icons/fab-add.xml');
const tableHeight = 36 + 4 + qolipGridRowCount * 68;
const tableWidth = qolipGridLetters.length * 80 - 4;
function Cell({ cell, locale, open, print }: { cell: QolipGridCell; locale: string; open: () => void; print: () => void }) {
  const colors = useMaterialColors(), filled = cell.items.length > 0;
  const quantity = localizedMethod('qolipQuantityShort', locale, { count: cell.quantity });
  return <Column verticalArrangement={filled ? "spaceBetween" : "center"} horizontalAlignment={filled ? "start" : "center"} modifiers={[size(76, 64), clip(Shapes.RoundedCorner(12)), background(cell.matchCount > 0 ? qolipGridMatchBackground(colors.secondaryContainer)
    : filled ? colors.secondaryContainer : colors.surfaceContainerHighest),
    semantics({ contentDescription: filled ? `${cell.label}, ${cell.title}, ${quantity}` : cell.label }), testID(`qolip-grid-cell-${cell.label}`),
    combinedClickable({ onClick: open, onLongClick: print }), paddingAll(6)]}>
    {filled ? <><Row><RNHostView matchContents><SymbolView name={{ android: 'layers' }} size={14}
      tintColor={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer} /></RNHostView><Text maxLines={1} overflow="ellipsis" color={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer}
      style={{ fontSize: 11, fontWeight: '800' }} modifiers={[weight(1)]}>{cell.title}</Text>{cell.matchCount > 0 && <Box contentAlignment="center" modifiers={[size(18, 18), clip(Shapes.Circle), background('#2E7D32')]}>
        <Text color="white" style={{ fontSize: 10, fontWeight: '900' }}>{String(cell.matchCount)}</Text></Box>}</Row>
      <Text color={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer} style={{ fontSize: 11, fontWeight: '700' }}>{quantity}</Text></>
      : <Icon source={addIcon} size={18} tint={colors.onSurfaceVariant} />}
  </Column>;
}
function GridTable({ rows, locale, openCell, printCell }: Pick<QolipHomeGridProps, 'openCell' | 'printCell'> & {
  rows: QolipGridCell[][]; locale: string;
}) {
  const { panHandlers, bindScroll, onScroll, onContentSizeChange, onViewportWidth } = useQolipGridScroll();
  const colors = useMaterialColors();
  return <View style={{ flexDirection: 'row', height: tableHeight, width: '100%' }}>
    <View {...panHandlers} style={{ width: 45, height: tableHeight }}><Host style={{ width: 42, height: tableHeight }}>
      <Column verticalArrangement={{ spacedBy: 4 }}>
        <Text modifiers={[size(42, 36)]}>{' '}</Text>
        {Array.from({ length: qolipGridRowCount }, (_, index) => <Box key={index} contentAlignment="center"
          modifiers={[size(42, 64), clip(Shapes.RoundedCorner(10)), background(colors.surfaceContainerHighest)]}><Text style={{ fontWeight: '800' }}>{String(index + 1)}</Text></Box>)}
      </Column></Host></View>
    <ScrollView ref={bindScroll} horizontal showsHorizontalScrollIndicator nestedScrollEnabled onScroll={onScroll} scrollEventThrottle={16}
      onContentSizeChange={onContentSizeChange} onLayout={event => onViewportWidth(event.nativeEvent.layout.width)}>
      <Host style={{ width: tableWidth, height: tableHeight }}><Column verticalArrangement={{ spacedBy: 4 }}>
        <Row horizontalArrangement={{ spacedBy: 4 }}>{qolipGridLetters.map(letter => <Box key={letter} contentAlignment="center"
          modifiers={[size(76, 36), clip(Shapes.RoundedCorner(10)), background(colors.primaryContainer)]}><Text style={{ fontWeight: '800' }}>{letter}</Text></Box>)}</Row>
        {rows.map((row, index) => <Row key={index} horizontalArrangement={{ spacedBy: 4 }}>{row.map(cell => <Cell key={cell.label} cell={cell} locale={locale}
          open={() => openCell(cell.letter, cell.row, cell.items)} print={() => printCell(cell.letter, cell.row)} />)}</Row>)}
      </Column></Host>
    </ScrollView>
  </View>;
}
const passthrough = () => true;
// The parent must supply real cell and printer actions; the home route is not wired yet.
export function QolipHomeGrid(props: QolipHomeGridProps) {
  const { text, locale } = useQolipText(), colors = useMaterialColors();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), insets = useSafeAreaInsets();
  if (props.locations === null && props.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (props.locations === null && props.error) return <Host style={{ flex: 1 }}><Column>
    <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><TextButton onClick={() => { void props.refresh(); }}>
      <Text>{localizedGetter('retry', locale)}</Text></TextButton>
  </Column></Host>;
  const grid = qolipGridCells(props.locations ?? [], props.searchCounts);
  return <OrdersList active passthrough={passthrough} headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={props.refresh}>
    <Host matchContents={{ vertical: true }}><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
      <Text>{text('home.occupied_count', { count: grid.occupiedCells })}</Text><Text>{text('home.mold_count_stat', { count: grid.totalQuantity })}</Text>
      {grid.unplaced.length > 0 && <Text>{text('home.unplaced_count', { count: grid.unplaced.length })}</Text>}</FlowRow></Host>
    <GridTable rows={grid.rows} locale={locale} openCell={props.openCell} printCell={props.printCell} />
    {grid.occupiedCells === 0 && grid.unplaced.length === 0 && <Host matchContents={{ vertical: true }}><Column>
      <Text>{text('home.no_molds')}</Text><Text>{text('home.attach_hint')}</Text></Column></Host>}
    {grid.unplaced.length > 0 && <Host matchContents={{ vertical: true }}><Text>{text('home.unplaced')}</Text></Host>}
    {grid.unplaced.map((item, index) => <WorkerQueueCard key={`${item.id}:${index}`} backgroundColor={colors.surface}>
      <SymbolView name={{ android: 'content_cut' }} size={18} tintColor={colors.onSurfaceVariant} />
      <View style={{ flex: 1, marginStart: 12 }}><NativeText numberOfLines={1} style={{ color: colors.onSurface }}>{item.item_name}</NativeText>
        <NativeText numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{`${item.qolip_code} • ${item.size} • ${localizedMethod('qolipCount', locale, { count: item.quantity })}`}</NativeText></View>
    </WorkerQueueCard>)}
    <View style={{ height: 320 + insets.bottom }} />
  </OrdersList>;
}

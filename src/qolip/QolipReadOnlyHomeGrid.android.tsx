import { Box, Column, FlowRow, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, paddingAll, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedMethod } from '../shared/localization';
import { qolipGridCells, qolipGridLetters, qolipGridMatchBackground, qolipGridRowCount, type QolipGridCell } from './qolipGridLogic';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { useQolipGridScroll } from './useQolipGridScroll';
import { useQolipText } from './useQolipText';
import { QolipReadOnlyRetry } from './QolipReadOnlyRetry';

const tableHeight = 36 + 4 + qolipGridRowCount * 68, tableWidth = qolipGridLetters.length * 80 - 4;
function Cell({ cell, locale }: { cell: QolipGridCell; locale: string }) {
  const colors = useMaterialColors(), filled = cell.items.length > 0, quantity = localizedMethod('qolipQuantityShort', locale, { count: cell.quantity });
  return <Column verticalArrangement={filled ? 'spaceBetween' : 'center'} horizontalAlignment={filled ? 'start' : 'center'}
    modifiers={[size(76, 64), clip(Shapes.RoundedCorner(12)), background(cell.matchCount > 0 ? qolipGridMatchBackground(colors.secondaryContainer)
      : filled ? colors.secondaryContainer : colors.surfaceContainerHighest),
    semantics({ contentDescription: filled ? `${cell.label}, ${cell.title}, ${quantity}` : cell.label }), testID(`qolip-grid-cell-${cell.label}`), paddingAll(6)]}>
    {filled && <><Row><RNHostView matchContents><SymbolView name={{ android: 'layers' }} size={14}
      tintColor={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer} /></RNHostView>
      <Text maxLines={1} overflow="ellipsis" color={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer}
        style={{ fontSize: 11, fontWeight: '800' }} modifiers={[weight(1)]}>{cell.title}</Text>
      {cell.matchCount > 0 && <Box contentAlignment="center" modifiers={[size(18, 18), clip(Shapes.Circle), background('#2E7D32')]}>
        <Text color="white" style={{ fontSize: 10, fontWeight: '900' }}>{String(cell.matchCount)}</Text></Box>}</Row>
      <Text color={cell.matchCount > 0 ? '#2E7D32' : colors.onSecondaryContainer} style={{ fontSize: 11, fontWeight: '700' }}>{quantity}</Text></>}
  </Column>;
}
function GridTable({ rows, locale }: { rows: QolipGridCell[][]; locale: string }) {
  const { panHandlers, bindScroll, onScroll, onContentSizeChange, onViewportWidth } = useQolipGridScroll(), colors = useMaterialColors();
  return <View style={{ flexDirection: 'row', height: tableHeight, width: '100%' }}>
    <View {...panHandlers} style={{ width: 45, height: tableHeight }}><Host style={{ width: 42, height: tableHeight }}><Column verticalArrangement={{ spacedBy: 4 }}>
      <Text modifiers={[size(42, 36)]}>{' '}</Text>
      {Array.from({ length: qolipGridRowCount }, (_, index) => <Box key={index} contentAlignment="center"
        modifiers={[size(42, 64), clip(Shapes.RoundedCorner(10)), background(colors.surfaceContainerHighest)]}><Text style={{ fontWeight: '800' }}>{String(index + 1)}</Text></Box>)}
    </Column></Host></View>
    <ScrollView ref={bindScroll} horizontal showsHorizontalScrollIndicator nestedScrollEnabled onScroll={onScroll} scrollEventThrottle={16}
      onContentSizeChange={onContentSizeChange} onLayout={event => onViewportWidth(event.nativeEvent.layout.width)}>
      <Host style={{ width: tableWidth, height: tableHeight }}><Column verticalArrangement={{ spacedBy: 4 }}>
        <Row horizontalArrangement={{ spacedBy: 4 }}>{qolipGridLetters.map(letter => <Box key={letter} contentAlignment="center"
          modifiers={[size(76, 36), clip(Shapes.RoundedCorner(10)), background(colors.primaryContainer)]}><Text style={{ fontWeight: '800' }}>{letter}</Text></Box>)}</Row>
        {rows.map((row, index) => <Row key={index} horizontalArrangement={{ spacedBy: 4 }}>{row.map(cell => <Cell key={cell.label} cell={cell} locale={locale} />)}</Row>)}
      </Column></Host>
    </ScrollView>
  </View>;
}
export function QolipReadOnlyHomeGrid(props: { locations: readonly QolipLocationEntry[] | null; loading: boolean; error: boolean;
  refreshUnavailable?: boolean; searchCounts: Readonly<Record<string, number>>; onRetry: () => void }) {
  const { text, locale } = useQolipText(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  if (props.locations === null && props.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (props.locations === null && props.error) return <QolipReadOnlyRetry refreshUnavailable={props.refreshUnavailable} onRetry={props.onRetry} />;
  const grid = qolipGridCells(props.locations ?? [], props.searchCounts);
  return <ScrollView nestedScrollEnabled contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <Host matchContents={{ vertical: true }}><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
      <Text>{text('home.occupied_count', { count: grid.occupiedCells })}</Text><Text>{text('home.mold_count_stat', { count: grid.totalQuantity })}</Text>
      {grid.unplaced.length > 0 && <Text>{text('home.unplaced_count', { count: grid.unplaced.length })}</Text>}</FlowRow></Host>
    <GridTable rows={grid.rows} locale={locale} />
    {grid.occupiedCells === 0 && grid.unplaced.length === 0 && <Host matchContents><Text>{text('home.no_molds')}</Text></Host>}
    {grid.unplaced.length > 0 && <Host matchContents={{ vertical: true }}><Column><Text>{text('home.unplaced')}</Text>
      {grid.unplaced.map((item, index) => <Row key={`${item.id}:${index}`}><RNHostView matchContents>
        <SymbolView name={{ android: 'content_cut' }} size={18} tintColor={colors.onSurfaceVariant} /></RNHostView><Column>
        <Text maxLines={1} overflow="ellipsis">{item.item_name}</Text>
        <Text maxLines={1} overflow="ellipsis">{`${item.qolip_code} • ${item.size} • ${localizedMethod('qolipCount', locale, { count: item.quantity })}`}</Text>
      </Column></Row>)}
    </Column></Host>}
  </ScrollView>;
}

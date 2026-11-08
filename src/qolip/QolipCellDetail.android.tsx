import { Button, Column, FilledIconButton, FilledTonalButton, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, combinedClickable, fillMaxWidth, paddingAll, semantics, Shapes, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { qolipCellDetailRowLabel } from './qolipCellDetailState';
import type { QolipCellDetailProps } from './qolipCellDetailProps';
import { useQolipCellDetail } from './useQolipCellDetail';
import { useQolipText } from './useQolipText';

// Content only. No opener, destination or mutation dispatch is provided.
export function QolipCellDetail(props: QolipCellDetailProps) {
  const state = useQolipCellDetail(props), { text, locale } = useQolipText(), colors = useMaterialColors(), { height } = useWindowDimensions();
  if (state.invalid) return null;
  const title = state.header.kind === 'selection' ? localizedMethod('qolipCount', locale, { count: state.header.count })
    : text('home.cell', { cell: state.header.label });
  return <View style={{ maxHeight: height * 0.82, paddingHorizontal: 16, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: 'titleLarge', fontWeight: '800' }} modifiers={[weight(1)]}>{title}</Text>
      {state.selectionMode && <FilledIconButton onClick={state.moveSelected} modifiers={[semantics({ contentDescription: text('home.move') }), testID('qolip-bulk-move-button')]}>
        <RNHostView matchContents><SymbolView name={{ android: 'drive_file_move' }} size={24} tintColor={colors.onPrimary} /></RNHostView>
      </FilledIconButton>}
    </Row></Host>
    <View style={{ height: 12 }} />
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 4 }}>
      {state.rows.map(({ item, selected, showActions, actionsEnabled }, index) => {
        const label = qolipCellDetailRowLabel(item, localizedMethod('qolipCount', locale, { count: item.quantity }));
        return <Host key={`${item.id}:${index}`} matchContents={{ vertical: true }}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }} modifiers={[
          fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(selected ? colors.secondaryContainer : colors.surfaceContainerHighest),
          combinedClickable({ onClick: () => state.controller.tap(item), onLongClick: () => state.controller.toggle(item) }),
          testID(`qolip-cell-detail-row-${index}`), paddingAll(10),
        ]}><RNHostView matchContents><SymbolView name={{ android: 'layers' }} size={20} tintColor={colors.primary} /></RNHostView>
          <Column modifiers={[weight(1)]}><Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleSmall', fontWeight: '700' }}>{label.title}</Text>
            <Text maxLines={1} overflow="ellipsis" color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant}>{label.subtitle}</Text></Column>
          {selected ? <RNHostView matchContents><SymbolView name={{ android: 'check_circle' }} size={24} tintColor={colors.primary} /></RNHostView>
            : showActions && <><FilledTonalButton enabled={actionsEnabled} onClick={() => state.moveOut(item)}><Text>{text('home.move')}</Text></FilledTonalButton>
              <FilledTonalButton enabled={actionsEnabled} onClick={() => state.take(item)}><Text>{text('home.take')}</Text></FilledTonalButton></>}
        </Row></Host>;
      })}
    </ScrollView>
    <View style={{ height: 10 }} />
    <Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 8 }}>
      {state.unplacedCount > 0 && <FilledTonalButton enabled={state.footerEnabled} onClick={state.placeUnplaced} modifiers={[fillMaxWidth()]}>
        <RNHostView matchContents><SymbolView name={{ android: 'warning' }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>
        <Text>{text('home.unplaced_molds', { count: state.unplacedCount })}</Text></FilledTonalButton>}
      {state.movableInCount > 0 && <FilledTonalButton enabled={state.footerEnabled} onClick={state.moveIn} modifiers={[fillMaxWidth()]}>
        <RNHostView matchContents><SymbolView name={{ android: 'move_down' }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>
        <Text>{text('home.move_from_other', { count: state.movableInCount })}</Text></FilledTonalButton>}
      <Button enabled={state.footerEnabled} onClick={state.add} modifiers={[fillMaxWidth(), testID('qolip-cell-detail-add')]}>
        <RNHostView matchContents><SymbolView name={{ android: 'add_location_alt' }} size={20} tintColor={colors.onPrimary} /></RNHostView>
        <Text>{text('home.add_here')}</Text></Button>
    </Column></Host>
  </View>;
}

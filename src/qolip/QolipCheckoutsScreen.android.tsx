import { useState } from 'react';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useQolipRole } from './QolipRoleContext';
import { Column, Host, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, combinedClickable, fillMaxWidth, paddingAll, semantics, Shapes, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, View , RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedMethod } from '../shared/localization';
import { qolipCheckoutDetailLines, qolipCheckoutRowText } from './qolipCheckoutLogic';
import { useQolipCheckouts } from './useQolipCheckouts';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useQolipText } from './useQolipText';

// @v2 QolipCheckoutsScreen
export function QolipCheckoutsScreen() {
  const { snapshot, returns, reload } = useQolipCheckouts();
  const role = useQolipRole(), [focused, setFocused] = useState(false);
  const { text, locale } = useQolipText(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { read, selection, actions } = snapshot;
  if (snapshot.invalid || !read || !selection || !actions) return null;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    {selection.selectionMode ? <Host matchContents={{ vertical: true }}><Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <IconButton enabled={selection.cancelEnabled} onClick={actions.cancelSelection} modifiers={[semantics({ contentDescription: text('checkouts.selection_cancel') })]}><RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurface} /></RNHostView></IconButton>
      <Text modifiers={[weight(1)]}>{text('checkouts.selection_summary', { count: selection.selectedIds.size })}</Text>
      <IconButton enabled={selection.bulkEnabled} onClick={() => { void returns.bulk(); }} modifiers={[semantics({ contentDescription: text('checkouts.selection_return') })]}><RNHostView matchContents><SymbolView name={{ android: 'keyboard_return' }} size={24} tintColor={colors.onSurface} /></RNHostView></IconButton>
    </Row></Host> : <OrdersHeader search={read.search} searchPlaceholder={text('checkouts.search')} onSearchChange={actions.setSearch} onMenu={role.onMenu} onProfile={role.onProfile}
      showProfile={!focused} onSearchFocus={() => setFocused(true)} onSearchBlur={() => setFocused(false)} />}
    {read.error && <WorkerSheetButton label={text('action.retry')} onPress={() => { void reload(); }} />}
    <ScrollView refreshControl={<RefreshControl refreshing={read.loading && read.entries !== null} onRefresh={() => { void reload(); }} />} contentContainerStyle={{ flexGrow: 1 }}>
    {read.loading && read.entries === null ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator />
      <Host matchContents={{ vertical: true }}><Text>{text('checkouts.loading')}</Text></Host></View>
      : read.error ? <Host style={{ flex: 1 }}><Text>{text('checkouts.load_failed')}</Text></Host>
        : read.entries?.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.empty')}</Text></Host>
          : read.visible.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.search_empty')}</Text></Host>
            : <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 112 }}>
              {selection.rows.map(row => {
                const entry = row.entry, quantity = localizedMethod('qolipCount', locale, { count: entry.quantity });
                const label = qolipCheckoutRowText(entry, text('checkouts.unknown_worker')), details = qolipCheckoutDetailLines(entry, quantity);
                const renderedSelectionMode = selection.selectionMode, renderedExpanded = row.expanded;
                return <Host key={`${entry.id}:${row.index}`} matchContents={{ vertical: true }}><Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)),
                  background(row.selected ? colors.secondaryContainer : colors.surface), paddingAll(8)]}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(),
                    combinedClickable({ onClick: () => actions.tap(entry, renderedSelectionMode, renderedExpanded), onLongClick: () => actions.longPress(entry) }),
                    testID(`qolip-checkout-row-${row.index}`)]}>
                    <Text>{row.selected ? '✓' : String(row.index + 1)}</Text><Column modifiers={[weight(1)]}>
                      <Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '700' }}>{label.title}</Text>
                      {!!label.subtitle && <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant}>{label.subtitle}</Text>}
                    </Column><Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '800' }}>{quantity}</Text>
                    {!selection.selectionMode && <RNHostView matchContents><SymbolView name={{ android: row.expanded ? 'expand_less' : 'expand_more' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>}
                  </Row>{row.expanded && <Column verticalArrangement={{ spacedBy: 6 }}>
                    {details.map(line => <Text key={line.key}>{`${text(`checkouts.${line.key}`)}: ${line.value}`}</Text>)}
                    <Text maxLines={1} overflow="ellipsis">{`${text('checkouts.checkout_id')}: ${entry.id}`}</Text>
                    <RNHostView matchContents><WorkerSheetButton label={text('action.return')} disabled={row.returning} height={54} onPress={() => { void returns.single(entry); }} /></RNHostView>
                  </Column>}
                </Column></Host>;
              })}
            </View>}
    </ScrollView>{role.dock}
  </View>;
}

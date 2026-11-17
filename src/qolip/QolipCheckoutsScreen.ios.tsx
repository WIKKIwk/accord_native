import { useState } from 'react';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useQolipRole } from './QolipRoleContext';
import { Button, Host, HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityIdentifier, background, contentShape, disabled, font, frame,
  labelStyle, lineLimit, onLongPressGesture, onTapGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View , RefreshControl } from 'react-native';
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
  const { text, locale } = useQolipText(), insets = useSafeAreaInsets();
  const { read, selection, actions } = snapshot;
  if (snapshot.invalid || !read || !selection || !actions) return null;
  return <View style={{ flex: 1 }}>
    {selection.selectionMode ? <Host matchContents={{ vertical: true }}><HStack spacing={12}>
      <Button label={text('checkouts.selection_cancel')} systemImage="xmark" onPress={actions.cancelSelection} modifiers={[disabled(!selection.cancelEnabled), labelStyle('iconOnly')]} />
      <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{text('checkouts.selection_summary', { count: selection.selectedIds.size })}</Text>
      <Button label={text('checkouts.selection_return')} systemImage="return" onPress={() => { void returns.bulk(); }} modifiers={[disabled(!selection.bulkEnabled), labelStyle('iconOnly')]} />
    </HStack></Host> : <OrdersHeader search={read.search} searchPlaceholder={text('checkouts.search')} onSearchChange={actions.setSearch} onMenu={role.onMenu} onProfile={role.onProfile}
      showProfile={!focused} onSearchFocus={() => setFocused(true)} onSearchBlur={() => setFocused(false)} />}
    {read.error && <WorkerSheetButton label={text('action.retry')} onPress={() => { void reload(); }} />}
    <ScrollView refreshControl={<RefreshControl refreshing={read.loading && read.entries !== null} onRefresh={() => { void reload(); }} />} contentContainerStyle={{ flexGrow: 1 }}>
    {read.loading && read.entries === null ? <Host style={{ flex: 1 }}><VStack spacing={12}><ProgressView /><Text>{text('checkouts.loading')}</Text></VStack></Host>
      : read.error ? <Host style={{ flex: 1 }}><Text>{text('checkouts.load_failed')}</Text></Host>
        : read.entries?.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.empty')}</Text></Host>
          : read.visible.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.search_empty')}</Text></Host>
            : <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 112 }}>
              {selection.rows.map(row => {
                const entry = row.entry, quantity = localizedMethod('qolipCount', locale, { count: entry.quantity });
                const label = qolipCheckoutRowText(entry, text('checkouts.unknown_worker'));
                const details = qolipCheckoutDetailLines(entry, quantity);
                const renderedSelectionMode = selection.selectionMode, renderedExpanded = row.expanded;
                return <Host key={`${entry.id}:${row.index}`} matchContents={{ vertical: true }}><VStack alignment="leading" spacing={4} modifiers={[
                  frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 14, vertical: 8 }),
                  background(PlatformColor(row.selected ? 'secondarySystemFill' : 'systemBackground'), shapes.roundedRectangle({ cornerRadius: 12 })),
                ]}><HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()),
                  accessibilityIdentifier(`qolip-checkout-row-${row.index}`), ...(row.selected ? [accessibilityAddTraits(['isSelected'])] : []),
                  onTapGesture(() => actions.tap(entry, renderedSelectionMode, renderedExpanded)), onLongPressGesture(() => actions.longPress(entry))]}>
                  <Text>{row.selected ? '✓' : String(row.index + 1)}</Text><VStack alignment="leading" spacing={4}
                    modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                    <Text modifiers={[font({ weight: 'bold' }), lineLimit(1)]}>{label.title}</Text>
                    {!!label.subtitle && <Text modifiers={[lineLimit(1)]}>{label.subtitle}</Text>}
                  </VStack><Text modifiers={[lineLimit(1)]}>{quantity}</Text>{!selection.selectionMode && <Image systemName={row.expanded ? 'chevron.up' : 'chevron.down'} />}
                </HStack>{row.expanded && <VStack alignment="leading" spacing={6}>
                  {details.map(line => <Text key={line.key}>{`${text(`checkouts.${line.key}`)}: ${line.value}`}</Text>)}
                  <Text modifiers={[lineLimit(1)]}>{`${text('checkouts.checkout_id')}: ${entry.id}`}</Text>
                  <Button label={text('action.return')} onPress={() => { void returns.single(entry); }} modifiers={[disabled(row.returning)]} />
                </VStack>}</VStack></Host>;
              })}
            </View>}
    </ScrollView>{role.dock}
  </View>;
}

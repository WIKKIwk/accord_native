import { Button, Host, HStack, Image, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityIdentifier, accessibilityLabel, background, contentShape, disabled, font, frame,
  labelStyle, lineLimit, onLongPressGesture, onTapGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { qolipCheckoutDetailLines, qolipCheckoutRowText } from './qolipCheckoutLogic';
import type { QolipCheckoutReadContentProps } from './qolipCheckoutReadContentProps';
import { useQolipText } from './useQolipText';

// Unmounted partial content. Unsafe return, bulk-return, refresh and retry controls are absent.
export function QolipCheckoutReadContent({ snapshot }: QolipCheckoutReadContentProps) {
  const input = useNativeState(snapshot.read?.search ?? ''), { text, locale } = useQolipText(), insets = useSafeAreaInsets();
  const { read, selection, actions } = snapshot;
  if (snapshot.invalid || !read || !selection || !actions) return null;
  const title = text('checkouts.selection_summary', { count: selection.selectedIds.size });
  return <View style={{ flex: 1 }}>
    <Host matchContents={{ vertical: true }}><HStack spacing={8}>
      {selection.selectionMode ? <>
        <Button label={text('checkouts.selection_cancel')} systemImage="xmark" onPress={actions.cancelSelection}
          modifiers={[labelStyle('iconOnly'), accessibilityLabel(text('checkouts.selection_cancel')), disabled(!selection.cancelEnabled)]} />
        <Text modifiers={[font({ weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{title}</Text>
      </> : <>
        <Image systemName="magnifyingglass" /><TextField text={input} placeholder={text('checkouts.search')}
          onTextChange={actions.setSearch} modifiers={[frame({ maxWidth: Infinity })]} />
        {read.search !== '' && <Button label={localizedGetter('clearTitle', locale)} systemImage="xmark.circle.fill" onPress={() => { input.set(''); actions.setSearch(''); }}
          modifiers={[labelStyle('iconOnly'), accessibilityLabel(localizedGetter('clearTitle', locale))]} />}
      </>}
    </HStack></Host>
    {read.loading && read.entries === null ? <Host style={{ flex: 1 }}><VStack spacing={12}><ProgressView /><Text>{text('checkouts.loading')}</Text></VStack></Host>
      : read.error ? <Host style={{ flex: 1 }}><Text>{text('checkouts.load_failed')}</Text></Host>
        : read.entries?.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.empty')}</Text></Host>
          : read.visible.length === 0 ? <Host style={{ flex: 1 }}><Text>{text('checkouts.search_empty')}</Text></Host>
            : <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 112 }}>
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
                </VStack>}</VStack></Host>;
              })}
            </ScrollView>}
  </View>;
}

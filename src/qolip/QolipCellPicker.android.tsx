import { Checkbox, Host, OutlinedTextField, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import { qolipPlacementPickerSubtitle, qolipPlacementPickerTitle, qolipPlacementProductKey } from './qolipCellPlacement';
import type { QolipCellPickerProps } from './qolipCellPickerProps';
import { useQolipCellPicker } from './useQolipCellPicker';
import { useQolipText } from './useQolipText';

// Reused by the cell-attach sheet; it is not a routed role surface yet.
export function QolipCellPicker({ placement, close, single, multiple }: QolipCellPickerProps) {
  const state = useQolipCellPicker(placement), search = useNativeState(''), { text, locale } = useQolipText();
  const colors = useMaterialColors(), { height } = useWindowDimensions(), selecting = state.selected.size > 0;
  return <View style={{ height: height * 0.66, paddingTop: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
      <NativeText style={{ flex: 1, color: colors.onSurface, fontSize: 20 }}>{selecting
        ? text('products.mold_count', { count: state.selected.size }) : text('home.mold_select_title')}</NativeText>
      {selecting && <Pressable accessibilityRole="button" accessibilityLabel={text('action.confirm_selected')}
        onPress={() => multiple(state.selectedProducts)} testID="qolip-picker-confirm" style={{ padding: 10 }}>
        <SymbolView name={{ android: 'check' }} size={24} tintColor={colors.primary} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={localizedGetter('closeAction', locale)} onPress={close} style={{ padding: 10 }}>
        <SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurfaceVariant} /></Pressable>
    </View>
    <Host matchContents={{ vertical: true }} style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <OutlinedTextField value={search} singleLine onValueChange={value => state.controller.setQuery(value)} modifiers={[fillMaxWidth(), testID('qolip-picker-search')]}>
        <OutlinedTextField.Placeholder><Text>{text('home.mold_code_customer_search')}</Text></OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </Host>
    {state.loading ? <ActivityIndicator /> : state.error ? <Host matchContents={{ vertical: true }}>
      <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
      <TextButton onClick={() => { void state.controller.retry(); }}><Text>{localizedGetter('retry', locale)}</Text></TextButton>
    </Host> : <FlatList data={state.visibleItems} nestedScrollEnabled keyboardShouldPersistTaps="handled"
      keyExtractor={item => qolipPlacementProductKey(item)} onEndReached={() => { void state.controller.loadMore(); }} onEndReachedThreshold={0.4}
      ListEmptyComponent={<Host matchContents={{ vertical: true }}><Text>{localizedGetter('noRecordsYet', locale)}</Text></Host>}
      ListFooterComponent={state.loadingMore ? <ActivityIndicator /> : undefined}
      renderItem={({ item, index }) => {
        const selected = state.selected.has(qolipPlacementProductKey(item));
        return <WorkerQueueCard backgroundColor={selected ? colors.secondaryContainer : colors.surfaceContainerHighest}
          first={index === 0} last={index === state.visibleItems.length - 1}
          onPress={() => { const picked = state.controller.tap(item); if (picked) single(picked); }}
          onLongPress={() => state.controller.toggle(item)}>
          <View style={{ flex: 1, paddingVertical: 8 }}>
            <NativeText numberOfLines={1} style={{ color: colors.onSurface, fontSize: 17, fontWeight: '600' }}>{qolipPlacementPickerTitle(item)}</NativeText>
            <NativeText numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{qolipPlacementPickerSubtitle(item)}</NativeText>
          </View>
          {selecting && <Host matchContents><Checkbox value={selected} onCheckedChange={() => state.controller.toggle(item)} modifiers={[semantics({ contentDescription: qolipPlacementPickerTitle(item) })]} /></Host>}
        </WorkerQueueCard>;
      }} />}
  </View>;
}

import { Checkbox, Host, OutlinedTextField, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import type { QolipHomePickerProps } from './qolipHomePickerTypes';
import { useQolipHomePicker } from './useQolipHomePicker';
import { useQolipText } from './useQolipText';

export function QolipHomePicker<T>(props: QolipHomePickerProps<T>) {
  const model = useQolipHomePicker(props), input = useNativeState(''), colors = useMaterialColors();
  const { text, locale } = useQolipText(), { height } = useWindowDimensions();
  if (!model.valid) return null;
  return <View style={{ height: height * 0.66, paddingTop: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
      <NativeText style={{ flex: 1, color: colors.onSurface, fontSize: 20 }}>{model.selected.size ? text('products.mold_count', { count: model.selected.size }) : props.title}</NativeText>
      {model.selected.size > 0 && <Pressable accessibilityRole="button" accessibilityLabel={text('action.confirm_selected')} onPress={model.confirm} style={{ padding: 12 }}>
        <SymbolView name={{ android: 'check' }} size={24} tintColor={colors.primary} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={localizedGetter('closeAction', locale)} onPress={props.close} style={{ padding: 12 }}>
        <SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurfaceVariant} /></Pressable>
    </View>
    <Host matchContents={{ vertical: true }} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <OutlinedTextField value={input} singleLine onValueChange={model.setQuery} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><Text>{props.hint}</Text></OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </Host>
    {model.error ? <Host matchContents><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><TextButton onClick={model.retry}><Text>{localizedGetter('retry', locale)}</Text></TextButton></Host>
      : model.busy && !model.items.length ? <ActivityIndicator /> : <FlatList data={model.items} keyExtractor={props.itemKey} nestedScrollEnabled keyboardShouldPersistTaps="handled"
        onEndReached={model.loadMore} onEndReachedThreshold={0.4} ListFooterComponent={model.busy ? <ActivityIndicator /> : undefined}
        ListEmptyComponent={<Host matchContents><Text>{localizedGetter('noRecordsYet', locale)}</Text></Host>}
        renderItem={({ item, index }) => <WorkerQueueCard first={index === 0} last={index === model.items.length - 1}
          backgroundColor={model.selected.has(props.itemKey(item)) ? colors.secondaryContainer : colors.surfaceContainerHighest}
          onPress={() => model.tap(item)} onLongPress={props.multiple ? () => model.toggle(item) : undefined}>
          <View style={{ flex: 1, paddingVertical: 10 }}><NativeText style={{ color: colors.onSurface, fontSize: 17, fontWeight: '600' }}>{props.itemTitle(item)}</NativeText>
            <NativeText style={{ color: colors.onSurfaceVariant }}>{props.itemSubtitle(item)}</NativeText></View>
          {model.selected.size > 0 && <Host matchContents><Checkbox value={model.selected.has(props.itemKey(item))} onCheckedChange={() => model.toggle(item)} /></Host>}
        </WorkerQueueCard>} />}
  </View>;
}

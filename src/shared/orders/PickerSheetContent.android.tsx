import { Host, TextInput, useNativeState } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useEffect,type ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerIconButton } from '../../components/WorkerIconButton.android';
import { WorkerQueueCard } from '../../components/WorkerQueueCard.android';
import { OrdersList } from './OrdersList';

type PickerItem = { key: string; title: string; subtitle?: string; selected?: boolean; select: () => void };
type Props = {
  title: string; hint?: string; closeLabel: string; emptyLabel?: string; searchEnabled?: boolean;
  items: readonly PickerItem[]; onClose: () => void; onSearch?: (query: string) => void;
  query?: string; loading?: boolean; error?: string; retryLabel?: string; onRetry?: () => void;
  hasMore?: boolean; onLoadMore?: () => void; photoLabel?: string; onPhoto?: () => void;
  photoLoading?: boolean; photoError?: string;autoFocus?:boolean;headerAction?:ReactElement;
};
const passthrough = () => true;

/** Picker rows use the same segmented cards as the order and material lists. */
export function PickerSheetContent({ title, hint, closeLabel, emptyLabel, searchEnabled = true, items, onClose, onSearch,
  query, loading = false, error, retryLabel, onRetry, hasMore = false, onLoadMore,
  photoLabel, onPhoto, photoLoading = false, photoError,autoFocus=false,headerAction }: Props) {
  const colors = useMaterialColors(), input = useNativeState(query ?? '');
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => { if (query !== undefined && input.get() !== query) input.set(query); }, [input, query]);
  const loadMore = () => {
    if (hasMore && !loading) onLoadMore?.();
  };
  return <GestureHandlerRootView style={styles.content}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {headerAction}<WorkerIconButton icon="close" label={closeLabel} onPress={onClose} />
    </View>
    {searchEnabled ? <View style={[styles.search, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
      <SymbolView name={{ android: 'search' }} size={24} tintColor={colors.onSurfaceVariant} />
      <Host matchContents={{ vertical: true }} style={styles.searchInput}>
        <TextInput autoFocus={autoFocus} value={input} onChangeText={onSearch} placeholder={hint} accessibilityLabel={hint}
          placeholderTextColor={colors.onSurfaceVariant} textStyle={{ color: colors.onSurface, fontSize: 16 }}
          style={{ width: '100%' }} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      </Host>
      {onPhoto && <Pressable accessibilityRole="button" accessibilityLabel={photoLabel} disabled={photoLoading} onPress={onPhoto} hitSlop={8}>
        <SymbolView name={{ android: 'qr_code_scanner' }} size={22} tintColor={colors.onSurfaceVariant} />
      </Pressable>}
    </View> : null}
    {photoLoading ? <ActivityIndicator /> : null}
    {photoError ? <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{photoError}</Text> : null}
    <OrdersList<PickerItem> active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}
      rows={items} rowKey={item => item.key} passthrough={passthrough} keyboardShouldPersistTaps="handled" onEndReached={loadMore}
      renderRow={(item, index) => <WorkerQueueCard backgroundColor={item.selected ? colors.primaryContainer : colors.surfaceContainerHighest}
        selected={item.selected} first={index === 0} last={index === items.length - 1} onPress={item.select}>
        <View style={styles.row}>
          <Text style={[styles.rowTitle, { color: item.selected ? colors.onPrimaryContainer : colors.onSurface }]}>{item.title}</Text>
          {item.subtitle ? <Text style={[styles.rowSubtitle, { color: item.selected ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>{item.subtitle}</Text> : null}
        </View>
      </WorkerQueueCard>}
      footer={<>{loading ? <ActivityIndicator style={styles.progress} /> : null}
        {error ? <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant }}>{error}</Text>
          {onRetry && retryLabel ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
            <Text style={{ color: colors.primary }}>{retryLabel}</Text></Pressable> : null}</View> : null}</>}>
      {emptyLabel != null && !items.length && !loading && !error ? <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>{emptyLabel}</Text> : null}
    </OrdersList>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: 6, gap: 12 },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '500', includeFontPadding: false },
  search: { marginHorizontal: 12, minHeight: 58, paddingHorizontal: 18, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchInput: { flex: 1 },
  row: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  rowTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', includeFontPadding: false },
  rowSubtitle: { fontSize: 12, lineHeight: 17, includeFontPadding: false },
  empty: { padding: 24, textAlign: 'center' }, progress: { padding: 16 },
  message: { paddingHorizontal: 16 }, error: { padding: 20, alignItems: 'center', gap: 8 }, retry: { padding: 8 },
});

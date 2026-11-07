import { Host, TextInput } from '@expo/ui';
import { useMaterialColors, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerIconButton } from '../components/WorkerIconButton.android';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.android';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { preparationOrderCandidateLabel, type PreparationOrderCandidate } from './preparationOrderCandidateSearch';
import { usePreparationInventoryOrderPicker } from './usePreparationInventoryOrderPicker';
import { usePreparationText } from './PreparationUI.android';

export function PreparationInventoryOrderPicker({ candidates, onClose, onSelect }: {
  candidates: readonly PreparationOrderCandidate[]; onClose: () => void; onSelect: (candidate: PreparationOrderCandidate) => void;
}) {
  const colors = useMaterialColors(), t = usePreparationText(), picker = usePreparationInventoryOrderPicker(candidates);
  const { height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const sheetRef = useRef<ModalBottomSheetRef>(null), closing = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dismiss = (candidate?: PreparationOrderCandidate) => {
    if (closing.current) return;
    closing.current = true; Keyboard.dismiss();
    void (async () => {
      try { await sheetRef.current?.hide(); } catch { /* The sheet may already be closing. */ }
      if (!mounted.current) return;
      if (candidate) onSelect(candidate); else onClose();
    })();
  };
  const dismissed = () => { if (mounted.current && !closing.current) { closing.current = true; Keyboard.dismiss(); onClose(); } };
  return <WorkerOrderSheet sheetRef={sheetRef} onClose={dismissed} dismissible fitContent>
    <View style={[styles.content, { height: Math.round((height - insets.top - insets.bottom) * 0.6) }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{t('Buyurtmani tanlang')}</Text>
        <WorkerIconButton icon="close" label={t('Yopish')} onPress={() => dismiss()} />
      </View>
      <View style={[styles.search, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
        <SymbolView name={{ android: 'search' }} size={24} tintColor={colors.onSurfaceVariant} />
        <Host matchContents={{ vertical: true }} style={styles.searchInput}>
          <TextInput onChangeText={picker.setInput} placeholder={t('Buyurtma qidiring')} accessibilityLabel={t('Buyurtma qidiring')}
            placeholderTextColor={colors.onSurfaceVariant} textStyle={{ color: colors.onSurface, fontSize: 16 }}
            style={{ width: '100%' }} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        </Host>
      </View>
      <FlatList data={picker.items} keyExtractor={item => item.order.map.id} nestedScrollEnabled keyboardShouldPersistTaps="handled"
        style={styles.list} contentContainerStyle={styles.listContent} onEndReached={picker.loadMore} onEndReachedThreshold={0.5}
        removeClippedSubviews={false} renderItem={({ item, index }) => <WorkerQueueCard backgroundColor={colors.surface}
          first={index === 0} last={index === picker.items.length - 1} onPress={() => dismiss(item)}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.onSurface }]}>{preparationOrderCandidateLabel(item)}</Text>
            {item.order.map.id.trim() ? <Text style={[styles.rowSubtitle, { color: colors.onSurfaceVariant }]}>{item.order.map.id.trim()}</Text> : null}
          </View>
        </WorkerQueueCard>}
        ListEmptyComponent={<View style={styles.empty}><Text style={{ color: colors.onSurfaceVariant }}>
          {t('Bu ro‘yxatda hozircha yozuv yo‘q.')}
        </Text></View>} />
    </View>
  </WorkerOrderSheet>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12 },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  search: { marginHorizontal: 16, minHeight: 56, paddingHorizontal: 16, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchInput: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: 8 },
  row: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  rowTitle: { fontSize: 16, lineHeight: 24, fontWeight: '500', includeFontPadding: false },
  rowSubtitle: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  empty: { padding: 24, alignItems: 'center' },
});

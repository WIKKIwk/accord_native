import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { PreparationMaterial } from './preparationLogic';
import { usePreparationSeriyoPicker } from './usePreparationSeriyoPicker';
import { PreparationField, PreparationText, usePreparationText } from './PreparationUI.android';

export function PreparationSeriyoPicker({ materials, choose, title = 'Seriyo tanlang', subtitle, searchText }: {
  materials: PreparationMaterial[]; choose: (material: PreparationMaterial) => void; title?: string;
  subtitle?: (material: PreparationMaterial) => string; searchText?: (material: PreparationMaterial) => string;
}) {
  const t = usePreparationText(), picker = usePreparationSeriyoPicker(materials, searchText);
  return <View style={{ flex: 1, paddingTop: 8, gap: 12 }}>
    <View style={{ paddingHorizontal: 16, gap: 12 }}><PreparationText title>{t(title)}</PreparationText>
      <PreparationField label="Qidirish" onChange={picker.setQuery} />
    </View>
    <FlatList data={picker.items} keyExtractor={item => item.code} onEndReached={picker.loadMore} onEndReachedThreshold={0.4}
      nestedScrollEnabled keyboardShouldPersistTaps="handled" renderItem={({ item, index }) => <SeriyoRow material={item} subtitle={subtitle?.(item)}
        first={index === 0} last={index === picker.items.length - 1} choose={() => choose(item)} />}
      contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }} ListEmptyComponent={<View style={{ padding: 16 }}>
        <PreparationText>{t('Bu ro‘yxatda hozircha yozuv yo‘q.')}</PreparationText>
      </View>} />
  </View>;
}

function SeriyoRow({ material, subtitle, first, last, choose }: {
  material: PreparationMaterial; subtitle?: string; first: boolean; last: boolean; choose: () => void;
}) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last} onPress={choose}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'inventory_2' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}>
      <Text style={[styles.headline, { color: colors.onSurface }]}>{material.name || material.code}</Text>
      {subtitle ? <Text style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
    </View>
  </WorkerQueueCard>;
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '500', includeFontPadding: false },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});

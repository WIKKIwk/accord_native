import { FlatList, View } from 'react-native';
import type { PreparationMaterial } from './preparationLogic';
import { usePreparationSeriyoPicker } from './usePreparationSeriyoPicker';
import { PreparationField, PreparationRow, PreparationText, usePreparationText } from './PreparationUI.android';

export function PreparationSeriyoPicker({ materials, choose }: { materials: PreparationMaterial[]; choose: (material: PreparationMaterial) => void }) {
  const t = usePreparationText(), picker = usePreparationSeriyoPicker(materials);
  return <View style={{ flex: 1, padding: 16, gap: 10 }}><PreparationText title>{t('Seriyo tanlang')}</PreparationText>
    <PreparationField label="Qidirish" onChange={picker.setQuery} />
    <FlatList data={picker.items} keyExtractor={item => item.code} onEndReached={picker.loadMore} onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled" renderItem={({ item }) => <PreparationRow title={item.name} onPress={() => choose(item)} />}
      contentContainerStyle={{ gap: 8, flexGrow: 1 }} ListEmptyComponent={<PreparationText>{t('Bu ro‘yxatda hozircha yozuv yo‘q.')}</PreparationText>} />
  </View>;
}

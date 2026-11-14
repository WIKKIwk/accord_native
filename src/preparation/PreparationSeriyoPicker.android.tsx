import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import type { PreparationMaterial } from './preparationLogic';
import { usePreparationSeriyoPicker } from './usePreparationSeriyoPicker';
import { usePreparationText } from './PreparationUI.android';

export function PreparationSeriyoPicker({ materials, choose, close, title = 'Seriyo tanlang', subtitle, searchText }: {
  materials: PreparationMaterial[]; choose: (material: PreparationMaterial) => void; close: () => void; title?: string;
  subtitle?: (material: PreparationMaterial) => string; searchText?: (material: PreparationMaterial) => string;
}) {
  const t = usePreparationText(), picker = usePreparationSeriyoPicker(materials, searchText);
  return <PickerSheetContent title={t(title)} hint={t('Qidirish')} closeLabel={t('Yopish')}
    emptyLabel={t('Bu ro‘yxatda hozircha yozuv yo‘q.')} onClose={close} onSearch={picker.setQuery}
    items={picker.items.map(item => ({ key: item.code, title: item.name || item.code,
      subtitle: subtitle?.(item), select: () => choose(item) }))}
    hasMore={picker.hasMore} onLoadMore={picker.loadMore} />;
}

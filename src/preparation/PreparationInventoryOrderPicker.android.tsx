import { type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useEffect, useRef } from 'react';
import { Keyboard, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.android';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import { preparationOrderCandidateLabel, type PreparationOrderCandidate } from './preparationOrderCandidateSearch';
import { usePreparationInventoryOrderPicker } from './usePreparationInventoryOrderPicker';
import { usePreparationText } from './PreparationUI.android';

export function PreparationInventoryOrderPicker({ candidates, onClose, onSelect }: {
  candidates: readonly PreparationOrderCandidate[]; onClose: () => void; onSelect: (candidate: PreparationOrderCandidate) => void;
}) {
  const t = usePreparationText(), picker = usePreparationInventoryOrderPicker(candidates);
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
    <View style={{ height: Math.round((height - insets.top - insets.bottom) * 0.66) }}>
      <PickerSheetContent title={t('Order tanlang')} hint={t('Buyurtma qidiring')} closeLabel={t('Yopish')}
        emptyLabel={t('Bu ro‘yxatda hozircha yozuv yo‘q.')} onClose={() => dismiss()} onSearch={picker.setInput}
        items={picker.items.map(item => ({ key: item.order.map.id, title: preparationOrderCandidateLabel(item),
          subtitle: item.order.map.id.trim(), select: () => dismiss(item) }))}
        hasMore={picker.hasMore} onLoadMore={picker.loadMore} />
    </View>
  </WorkerOrderSheet>;
}

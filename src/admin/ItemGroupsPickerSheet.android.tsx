import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useRef } from 'react';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.android';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent.android';
import type { ItemGroupsRouteModel } from './useItemGroupsRoute';

export function ItemGroupsPickerSheet({ model }: { model: ItemGroupsRouteModel }) {
  const { controller, state, pickerRows, t } = model, picker = state.picker!;
  const ref = useRef<ModalBottomSheetRef>(null), closed = useRef(false), closing = useRef(false), selected = useRef<string | null>(null);
  const finish = () => { if (!closed.current) { closed.current = true; controller.finishPicker(picker.id, selected.current); } };
  const close = (value: string | null) => { if (closing.current) return; closing.current = true; selected.current = value; void Promise.resolve(ref.current?.hide()).then(finish, finish); };
  return <WorkerOrderSheet dismissible sheetRef={ref} onClose={finish}>
    <PickerSheetContent title={t(picker.title)} hint={t(picker.hint)} closeLabel={t('action.close')} emptyLabel={t('item_group.not_found')}
      query={picker.query} onClose={() => close(null)} onSearch={value => controller.pickerSearch(picker.id, value)} hasMore={pickerRows.hasMore}
      onLoadMore={() => controller.pickerMore(picker.id)} items={pickerRows.items.map((group, index) => ({ key: `${index}:${group}`, title: group, select: () => close(group) }))} />
  </WorkerOrderSheet>;
}

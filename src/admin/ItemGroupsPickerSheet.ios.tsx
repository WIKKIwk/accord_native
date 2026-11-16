import { useContext, useRef } from 'react';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.ios';
import { WorkerSheetCloseContext } from '../components/workerSheetContext';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent.ios';
import type { ItemGroupsRouteModel } from './useItemGroupsRoute';

function Content({ model, choose }: { model: ItemGroupsRouteModel; choose: (value: string | null) => void }) {
  const close = useContext(WorkerSheetCloseContext), { controller, state, pickerRows, t } = model, picker = state.picker!;
  const finish = (value: string | null) => { choose(value); close?.(); };
  return <PickerSheetContent title={t(picker.title)} hint={t(picker.hint)} closeLabel={t('action.close')} emptyLabel={t('item_group.not_found')}
    query={picker.query} onClose={() => finish(null)} onSearch={value => controller.pickerSearch(picker.id, value)} hasMore={pickerRows.hasMore}
    onLoadMore={() => controller.pickerMore(picker.id)} items={pickerRows.items.map((group, index) => ({ key: `${index}:${group}`, title: group, select: () => finish(group) }))} />;
}
export function ItemGroupsPickerSheet({ model }: { model: ItemGroupsRouteModel }) {
  const id = model.state.picker!.id, selected = useRef<string | null>(null), closing = useRef(false), closed = useRef(false);
  const choose = (value: string | null) => { if (!closing.current) { closing.current = true; selected.current = value; } };
  const finish = () => { if (!closed.current) { closed.current = true; model.controller.finishPicker(id, selected.current); } };
  return <WorkerOrderSheet dismissible onClose={finish}><Content model={model} choose={choose} /></WorkerOrderSheet>;
}

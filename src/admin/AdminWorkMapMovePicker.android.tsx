import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import type { AdminWorkMapMovePickerProps } from './adminWorkMapMoveTypes';

export function AdminWorkMapMovePicker({ title, rows, onChoose, closeLabel, onClose }: AdminWorkMapMovePickerProps) {
  return <PickerSheetContent title={title} closeLabel={closeLabel} onClose={onClose} searchEnabled={false}
    items={rows.map(row => ({ key: row.key, title: row.name, selected: row.selected, select: () => onChoose(row.selection) }))} />;
}

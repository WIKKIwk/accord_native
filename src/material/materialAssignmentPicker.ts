import { searchMatches } from '../shared/searchNormalizer';
import type { AssignmentOrder } from './materialAssignmentsController';

/** @v2 _AdminRawMaterialAssignmentPanelState._openOrderPicker */
export function materialAssignmentPickerRows(orders: readonly AssignmentOrder[], input: string,
  orderLabel: (order: AssignmentOrder) => string, limit: number) {
  const query = input.trim().toLowerCase();
  const matching = query ? orders.filter(order => {
    const map = order.map;
    return searchMatches(query, [map.id, map.code, map.order_number, map.title, map.product_code, orderLabel(order)]);
  }) : orders;
  return { items: matching.slice(0, limit), hasMore: matching.length > limit };
}

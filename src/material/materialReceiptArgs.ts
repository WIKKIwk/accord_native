import type { GScaleModeArgs } from '../gscale/gscaleRouteArgs';
import { dartTrim } from '../shared/dartApparatus';
import type { readMaterialTaskDetail } from './materialTaskDetailApi';

type FullOrder = Awaited<ReturnType<typeof readMaterialTaskDetail>>;

/** @v2 _openMaterialOrderReceipt; mapping only, not permission to start a batch or print. */
export function materialReceiptArgs(order: FullOrder): GScaleModeArgs {
  const map = order.map, kg = map.order_kg;
  if (kg != null && !Number.isFinite(kg)) throw new TypeError('Invalid order weight');
  // V2 orderKg is double, so common integral doubles retain .0 in the displayed argument.
  const weight = kg == null ? '0' : Object.is(kg, -0) ? '-0.0'
    : Number.isInteger(kg) && !String(kg).includes('e') ? `${kg}.0` : String(kg);
  return { order: { id: map.id, code: dartTrim(map.code) ? map.code : map.order_number, title: map.title,
    width_mm: map.width_mm, order_kg: weight, saved: false } };
}

import { dartTrim } from '../shared/dartApparatus';
import type { Session } from '../auth';
import { qolipOrderProducts } from '../qolipOrderProductsApi';
import { adminRawMaterialAssignments, type AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { readMaterialTaskDetail } from './materialTaskDetailApi';

export type MaterialDetailOrder = Awaited<ReturnType<typeof readMaterialTaskDetail>>;
export type MaterialDetailMold = NonNullable<Awaited<ReturnType<typeof qolipOrderProducts>>[string]>;

/** @v2 _exactQolipHexColor */
export function materialMoldHexColor(value: string): string | null {
  const color = dartTrim(value);
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : null;
}

/** @v2 _rawMaterialAssignmentCanBeUnlinked */
export function materialDetailCanUnlink(row: AdminRawMaterialAssignment): boolean {
  const status = dartTrim(row.stock_status).toLowerCase();
  return !(row.consumed_qty > 0) && (status === '' || status === 'available');
}

/** @v2 _loadAttachedQolips */
export function materialDetailMolds(products: (MaterialDetailMold | null)[]): MaterialDetailMold[] {
  const seen = new Set<string>();
  return products.filter((product): product is MaterialDetailMold => {
    const key = product ? dartTrim(product.qolip_code).toLowerCase() : '';
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((left, right) => {
    const a = left.qolip_code.toLowerCase(), b = right.qolip_code.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** @v2 _fetchMaterialAssignments */
export async function materialDetailAssignments(session: Session, order: MaterialDetailOrder, guard: () => void) {
  guard();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const assignments = await Promise.race([adminRawMaterialAssignments(session, order.map.id, '', undefined, { beforeSend: guard }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('TimeoutException')), 5000); })]);
    guard(); return assignments;
  } finally { if (timeout !== undefined) clearTimeout(timeout); }
}

export async function materialDetailAttachedMolds(session: Session, order: MaterialDetailOrder, guard: () => void) {
  guard();
  if (!dartTrim(order.map.product_code)) return [];
  const products = await qolipOrderProducts(session, [order.map.id], undefined, { beforeSend: guard });
  guard(); return materialDetailMolds(Object.values(products));
}

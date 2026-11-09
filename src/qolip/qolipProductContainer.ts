import type { qolipProductFromJson } from '../qolipCatalogApi';
import { trimDart } from './qolipApiCommon';
import { qolipSimpleLower } from './qolipSimpleLower';

type Product = ReturnType<typeof qolipProductFromJson>;
/** @v2 QolipProductContainer */
export type QolipProductContainer = Readonly<{
  catalogId?: string | null;
  code: string;
  name: string;
  itemGroup: string;
  children: readonly Product[];
  imageOrderId: string;
}>;
const normalized = (value: string) => qolipSimpleLower(trimDart(value));
// Dart String.compareTo is lexicographic on UTF-16 code units, not locale collation.
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/** @v2 groupQolipProductsByContainer */
export function groupQolipProductsByContainer(products: Iterable<Product>): QolipProductContainer[] {
  const grouped = new Map<string, { code: string; name: string; itemGroup: string; children: Product[] }>();
  for (const product of products) {
    if (!trimDart(product.qolip_code)) continue;
    const code = trimDart(product.code), key = code ? qolipSimpleLower(code) : normalized(product.name);
    let group = grouped.get(key);
    if (!group) {
      group = { code, name: trimDart(product.name), itemGroup: trimDart(product.item_group), children: [] };
      grouped.set(key, group);
    }
    group.children.push(product);
  }
  return [...grouped.values()].map(group => ({ ...group, imageOrderId: '',
    children: [...group.children].sort((left, right) => compare(normalized(left.qolip_code), normalized(right.qolip_code))) }))
    .sort((left, right) => compare(normalized(left.name), normalized(right.name)));
}

export function qolipContainerKey(container: QolipProductContainer): string {
  if (container.catalogId != null) return container.catalogId;
  return normalized(container.code) || normalized(container.name);
}
export function qolipContainerHasInUse(container: QolipProductContainer): boolean {
  return container.children.some(child => child.is_in_use);
}
export function qolipContainerSets(container: QolipProductContainer): ReadonlyMap<string, readonly Product[]> {
  const sets = new Map<string, Product[]>(), extensions: Product[] = [];
  for (const child of container.children) {
    if (child.is_extension) { extensions.push(child); continue; }
    const existing = sets.get(child.set_id);
    if (existing) existing.push(child); else sets.set(child.set_id, [child]);
  }
  // V2 assigns this reserved key after collecting normal sets, even if a set used the same ID.
  if (extensions.length) sets.set('extensions', extensions);
  return sets;
}
export function qolipContainerOrderImageId(container: QolipProductContainer): string {
  for (const child of container.children) {
    const orderId = trimDart(child.order_image_order_id);
    if (orderId) return orderId;
  }
  return container.imageOrderId;
}

/** The card uses the name unless it is exactly empty, and counts each matching child, not distinct codes. */
export function qolipContainerTitle(container: QolipProductContainer): string {
  return container.name === '' ? container.code : container.name;
}
export function qolipContainerReworkCount(container: QolipProductContainer, reworkCodes: ReadonlySet<string>): number {
  return container.children.filter(child => reworkCodes.has(normalized(child.qolip_code))).length;
}

/** Project an already supplied source window and detail snapshot; this never reads or mutates a cache. */
export function qolipAdoptCatalogWindow(items: readonly { id: string; name: string; order_image_order_id: string }[],
  details: ReadonlyMap<string, readonly Product[]>) {
  const resolved = new Map<string, QolipProductContainer>();
  for (const item of items) {
    const products = details.get(item.id), groups = products ? groupQolipProductsByContainer(products) : [];
    if (groups.length !== 1) continue;
    const group = groups[0];
    resolved.set(item.id, { catalogId: item.id, code: group.code, name: item.name, itemGroup: group.itemGroup,
      imageOrderId: item.order_image_order_id, children: group.children });
  }
  const containers = items.map(item => resolved.get(item.id) ??
    { catalogId: item.id, code: '', name: item.name, itemGroup: '', imageOrderId: item.order_image_order_id, children: [] });
  return { containers, products: containers.flatMap(value => value.children) };
}

/** Source catalog product projection only. It does not authorize or dispatch a product mutation. */
export function qolipContainerCatalogProduct(container: QolipProductContainer): Product {
  const first = container.children[0];
  if (!first) throw new RangeError();
  const item = normalized(container.code), warehouse = normalized(first.warehouse);
  return { is_extension: false, qolip_set_id: '', set_id: `legacy:${[...item].length}:${item}:${warehouse}`,
    warehouse: first.warehouse, code: container.code, name: container.name, item_group: container.itemGroup,
    customer_names: first.customer_names, qolip_code: '', first_qolip_code: trimDart(first.first_qolip_code) ? first.first_qolip_code : first.qolip_code,
    size: 0, color: '', has_qolip_spec: false, is_in_use: false, is_in_rework: false,
    order_image_order_id: qolipContainerOrderImageId(container) };
}

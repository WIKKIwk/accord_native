import { trimDart } from './qolipApiCommon';
import { qolipVisibleColor } from './qolipColorPresentation';
import { qolipContainerHasInUse, qolipContainerOrderImageId, qolipContainerReworkCount, qolipContainerSets,
  qolipContainerTitle, type QolipProductContainer } from './qolipProductContainer';
import { qolipSimpleLower } from './qolipSimpleLower';

type Product = QolipProductContainer['children'][number];
export type QolipProductPassiveMember = Readonly<{ product: Product; inRework: boolean; color: string | null;
  subtitle: 'rework' | 'issued' | 'size' | 'empty' }>;
export type QolipProductPassiveSection = Readonly<{ id: string; extension: boolean; alternativeIndex: number | null;
  members: readonly QolipProductPassiveMember[] }>;

/** Source card data only. It performs no image lookup, selection, navigation or mutation. */
export function qolipProductPassivePresentation(container: QolipProductContainer, reworkCodes: ReadonlySet<string>) {
  const groups = [...qolipContainerSets(container)], normalCount = groups.filter(([key]) => key !== 'extensions').length;
  const sections: QolipProductPassiveSection[] = groups.map(([id, products], index) => {
    const extension = id === 'extensions';
    return { id, extension, alternativeIndex: !extension && normalCount > 1 ? index + 1 : null,
      members: products.map(product => {
        const inRework = reworkCodes.has(qolipSimpleLower(trimDart(product.qolip_code)));
        return { product, inRework, color: qolipVisibleColor(product.color), subtitle: inRework ? 'rework' : product.is_in_use ? 'issued'
          : product.size > 0 ? 'size' : 'empty' };
      }) };
  });
  return { title: qolipContainerTitle(container), hasDetails: container.children.length > 0, count: container.children.length,
    inUse: qolipContainerHasInUse(container), reworkCount: qolipContainerReworkCount(container, reworkCodes),
    coverId: qolipContainerOrderImageId(container), sections };
}

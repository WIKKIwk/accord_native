import { calculateOrderTemplateEffectivePrintMethod } from '../admin/calculateOrderTemplateModel';
import type { AdminApparatus } from '../apparatusApi';
import type { ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
import { productionMapRubberSizeFromWidth, productionMapRecommendedPechatColorCount, productionMapPechatCanHandleOrder } from '../admin/productionMapPechatRules';
import type { ProductionMapOrderContext } from './brigaderProductionMapArgs';
export const isProductionRezka = (node: Node, catalog: readonly AdminApparatus[]) => node.kind === 'apparatus' && catalog.some(item => item.id.trim() === (node.alternative_assigned_apparatus_id.trim() || node.apparatus_id.trim()) && item.operation.trim().toLowerCase() === 'cut');
const laminationFits = (item: AdminApparatus, width: number | null) => width === null || width <= 0 || productionMapRubberSizeFromWidth(width) <= (item.technology === 'extrusion_lamination' ? 1300 : 1050);
export function productionApparatusMatches(item: AdminApparatus, context: ProductionMapOrderContext | null) {
    if (item.operation === 'package' && context?.templateDraft?.status.trim().toLowerCase() === 'rulon')
        return false;
    if (item.operation === 'laminate' && !laminationFits(item, context?.widthMm ?? null))
        return false;
    if (item.operation !== 'print' || !context)
        return true;
    const method = context.templateDraft ? calculateOrderTemplateEffectivePrintMethod(context.templateDraft) : '', roll = context.rollCount, width = context.printValSizeMm ?? context.widthMm, template = context.templateDraft, profileWidth = context.printValSizeMm ?? (template?.products.length ? template.products.reduce((sum, row) => sum + row.frame_product_size_mm * row.frame_count, 0) : template && Number.isFinite(template.frame_product_size_mm) && template.frame_product_size_mm > 0 && Number.isFinite(template.frame_count) && template.frame_count > 0 ? template.frame_product_size_mm * template.frame_count : context.widthMm);
    if (method === 'flexo' && item.technology !== 'flexographic' || method === 'metal' && (item.technology !== 'rotogravure' || ![7, 8, 9].includes(item.color_stations ?? 0)))
        return false;
    if (roll !== null && roll > 0 && item.color_stations !== null && roll > item.color_stations || profileWidth !== null && profileWidth > 0 && (item.min_web_width_mm !== null && profileWidth < item.min_web_width_mm || item.max_web_width_mm !== null && profileWidth > item.max_web_width_mm))
        return false;
    if (item.technology === 'flexographic' || item.color_stations === null)
        return true;
    const recommended = productionMapRecommendedPechatColorCount(roll, width);
    return recommended === null ? roll === null && context.widthMm === null : productionMapPechatCanHandleOrder(item.color_stations, roll, width);
}
export function productionApparatusMatchesMap(item: AdminApparatus, context: ProductionMapOrderContext | null, nodes: readonly Node[], catalog: readonly AdminApparatus[]) { if (item.operation !== 'laminate')
    return productionApparatusMatches(item, context); const width = context?.widthMm ?? null; if (laminationFits(item, width))
    return true; if (width === null || width <= 0)
    return false; for (const node of nodes) {
    if (!isProductionRezka(node, catalog) || (node.rezka_kadr_count ?? 0) <= 0)
        continue;
    const count = node.rezka_kadr_count!, products = context?.templateDraft?.products ?? [];
    if (products.length) {
        const widths = products.flatMap(product => Array.from({ length: product.frame_count }, () => product.frame_product_size_mm)), groups = node.rezka_frame_groups.length ? node.rezka_frame_groups : Array(widths.length).fill(1) as number[];
        let offset = 0, fits = true;
        for (const count of groups) {
            if (count <= 0 || offset + count > widths.length) {
                fits = false;
                break;
            }
            if (!laminationFits(item, widths.slice(offset, offset + count).reduce((a, b) => a + b, 0)))
                fits = false;
            offset += count;
        }
        if (fits && offset === widths.length)
            return true;
        continue;
    }
    if (!node.rezka_frame_groups.length) {
        if (laminationFits(item, width / count))
            return true;
        continue;
    }
    if (node.rezka_frame_groups.reduce((a, b) => a + b, 0) === count && node.rezka_frame_groups.every(group => laminationFits(item, width * group / count)))
        return true;
} return false; }

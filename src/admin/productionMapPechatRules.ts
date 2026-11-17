/** @v2 production_map_pechat_rules.dart. Canonical physical limits, not display-name heuristics. */
export const productionMapRubberSizeFromWidth = (width: number) => { if (!Number.isFinite(width))
    throw new RangeError('Non-finite Dart ceil'); return Math.min(27, Math.max(1, Math.ceil(width / 50))) * 50; };
export function productionMapRecommendedPechatColorCount(roll: number | null, width: number | null) { const hasRoll = roll !== null && roll > 0, hasWidth = width !== null && width > 0; if (!hasRoll && !hasWidth)
    return null; let count = 0; if (hasRoll) {
    if (roll > 9)
        return null;
    count = roll > 8 ? 9 : roll > 7 ? 8 : 7;
} if (hasWidth) {
    const size = productionMapRubberSizeFromWidth(width);
    if (size > 1350)
        return null;
    count = Math.max(count, size > 1050 ? 9 : size > 850 ? 8 : 7);
} return count || null; }
export function productionMapPechatCanHandleOrder(count: number, roll: number | null, width: number | null) { if (roll !== null && roll > count)
    return false; if (width === null || width <= 0)
    return true; if (!Number.isFinite(width) || width > 1350)
    return false; const size = productionMapRubberSizeFromWidth(width); return count === 7 ? size <= 850 : count === 8 ? size >= 150 && size <= 1050 : count === 9 ? size >= 800 && size <= 1350 : false; }
export function productionMapPechatCompatibilitySummary(roll: number | null, width: number | null) { const recommended = productionMapRecommendedPechatColorCount(roll, width), compatible = [7, 8, 9].filter(count => (recommended === null || count >= recommended) && productionMapPechatCanHandleOrder(count, roll, width)), label = (count: number) => `${count} ta rangli bosma`; if (!compatible.length)
    return 'Mos bosma topilmadi'; const text = compatible.map(label).join(', '); return recommended === null ? `Mos bosma: ${text}` : `Minimal ${label(recommended)} • Mos: ${text}`; }

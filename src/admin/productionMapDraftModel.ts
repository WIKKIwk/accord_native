import { isCanonicalApparatusId } from '../workerControlsApi';
import type { productionMapDefinitionFromJson, productionMapNodeFromJson } from '../workerProductionMapSaved';
export type ProductionMapDraft = ReturnType<typeof productionMapDefinitionFromJson>;
export type ProductionMapDraftNode = ReturnType<typeof productionMapNodeFromJson>;
export function productionMapDraftNodeToJson(node: ProductionMapDraftNode): Record<string, unknown> {
    const result: Record<string, unknown> = { id: node.id, kind: node.kind, title: node.title };
    for (const key of ['apparatus_id', 'role_code', 'item_code', 'qty_formula', 'from_location', 'to_location', 'alternative_group_id', 'alternative_group_label', 'alternative_assigned_title', 'alternative_assigned_apparatus_id'] as const)
        if (node[key].trim())
            result[key] = node[key].trim();
    if (node.formula !== null)
        result.formula = { ...node.formula };
    if (node.rezka_kadr_count !== null)
        result.rezka_kadr_count = node.rezka_kadr_count;
    if (node.rezka_label_length !== null)
        result.rezka_label_length = node.rezka_label_length;
    if (node.rezka_frame_groups.length)
        result.rezka_frame_groups = [...node.rezka_frame_groups];
    return { ...result, x: node.x, y: node.y };
}
/** Source map/node/edge serialization, including omitted nullable and empty fields. */
export function productionMapDraftToJson(map: ProductionMapDraft): Record<string, unknown> {
    const result: Record<string, unknown> = { ...(map.combo !== null ? { combo: { ...map.combo } } : {}), ...(map.products.length ? { products: map.products.map(product => ({ ...product })) } : {}), id: map.id, product_code: map.product_code, title: map.title };
    for (const key of ['code', 'order_number', 'customer_name', 'image_id'] as const)
        if (map[key].trim())
            result[key] = map[key].trim();
    for (const key of ['roll_count', 'width_mm', 'print_val_size_mm', 'order_kg', 'base_length', 'duplicate_rezka_labels', 'include_bobina_in_net', 'standard_print_side'] as const)
        if (map[key] !== null)
            result[key] = map[key];
    result.nodes = map.nodes.map(productionMapDraftNodeToJson);
    result.edges = map.edges.map(edge => ({ from: edge.from, to: edge.to, ...(edge.branch.trim() ? { branch: edge.branch.trim() } : {}) }));
    return result;
}
export function productionMapWithoutAlternativeAssignments(map: ProductionMapDraft): ProductionMapDraft { return { ...map, nodes: map.nodes.map(node => node.alternative_assigned_title.trim() || node.alternative_assigned_apparatus_id.trim() ? { ...node, alternative_assigned_title: '', alternative_assigned_apparatus_id: '' } : node) }; }
export function requireProductionMapApparatusIds(map: ProductionMapDraft) { for (const node of map.nodes) {
    if (node.kind === 'apparatus' && !isCanonicalApparatusId(node.apparatus_id) || node.apparatus_id && !isCanonicalApparatusId(node.apparatus_id) || node.alternative_assigned_apparatus_id && !isCanonicalApparatusId(node.alternative_assigned_apparatus_id))
        throw new TypeError('Canonical apparatus ID is required');
} }
export const productionDraftJson = (value: unknown) => JSON.stringify(value, (_key, value: unknown) => { if (typeof value === 'number' && !Number.isFinite(value))
    throw new TypeError('Non-finite JSON number'); return value; });

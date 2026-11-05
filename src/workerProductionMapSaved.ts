import { isCanonicalApparatusId } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const requiredObject = (value: unknown): Obj => { const row = object(value); if (!row) throw new TypeError('Expected an object'); return row; };
const string = (value: unknown, fallback = ''): string => {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new TypeError('Expected a string');
  return value;
};
const text = (value: unknown): string => value == null ? '' : String(value);
const numeric = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== 'number') throw new TypeError('Expected a number');
  return value;
};
const integer = (value: unknown): number | null => {
  const n = numeric(value); if (n == null) return null;
  if (!Number.isFinite(n)) throw new TypeError('Expected a finite integer');
  return Math.trunc(n);
};
const boolean = (value: unknown): boolean | null => {
  if (value == null) return null;
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
  return value;
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Expected a list');
  return value;
};

export function productionMapNodeFromJson(value: unknown) {
  const row = requiredObject(value), kind = string(row.kind, 'task'), apparatus = string(row.apparatus_id);
  const alternative = string(row.alternative_assigned_apparatus_id);
  if ((kind === 'apparatus' && !isCanonicalApparatusId(apparatus)) ||
      (!!apparatus && !isCanonicalApparatusId(apparatus)) || (!!alternative && !isCanonicalApparatusId(alternative))) {
    throw new TypeError('Production apparatus nodes require canonical apparatus IDs');
  }
  const rawFormula = object(row.formula);
  return { id: string(row.id), kind, title: string(row.title), apparatus_id: apparatus,
    formula: rawFormula ? { target: string(rawFormula.target), expression: string(rawFormula.expression) } : null,
    role_code: string(row.role_code), item_code: string(row.item_code), qty_formula: string(row.qty_formula),
    from_location: string(row.from_location), to_location: string(row.to_location), alternative_group_id: string(row.alternative_group_id),
    alternative_group_label: string(row.alternative_group_label), alternative_assigned_title: string(row.alternative_assigned_title),
    alternative_assigned_apparatus_id: alternative, rezka_kadr_count: integer(row.rezka_kadr_count),
    rezka_label_length: numeric(row.rezka_label_length), rezka_frame_groups: list(row.rezka_frame_groups)
      .filter((item): item is number => typeof item === 'number' && Number.isFinite(item)).map(Math.trunc).filter(item => item > 0),
    x: numeric(row.x) ?? 0, y: numeric(row.y) ?? 0 };
}
export function orderProductFromJson(value: unknown) {
  const row = requiredObject(value);
  return { id: string(row.id), item_code: string(row.item_code), product: string(row.product),
    frame_product_size_mm: numeric(row.frame_product_size_mm) ?? 0, frame_count: integer(row.frame_count) ?? 0 };
}
export function comboFromJson(value: unknown) {
  const row = object(value); if (!row) return null;
  return { id: text(row.id), item_code: text(row.item_code), name: text(row.name), revision: integer(row.revision) ?? 0,
    layout_fingerprint: text(row.layout_fingerprint) };
}
export function productionMapDefinitionFromJson(value: unknown) {
  const row = requiredObject(value);
  return { products: (Array.isArray(row.products) ? row.products.filter(item => object(item)) : []).map(orderProductFromJson),
    combo: comboFromJson(row.combo), id: string(row.id), product_code: string(row.product_code), title: string(row.title),
    code: string(row.code), order_number: string(row.order_number), customer_name: string(row.customer_name), image_id: string(row.image_id),
    roll_count: numeric(row.roll_count), width_mm: numeric(row.width_mm), print_val_size_mm: numeric(row.print_val_size_mm),
    order_kg: numeric(row.order_kg), base_length: numeric(row.base_length), duplicate_rezka_labels: boolean(row.duplicate_rezka_labels),
    include_bobina_in_net: boolean(row.include_bobina_in_net), standard_print_side: boolean(row.standard_print_side),
    nodes: list(row.nodes).map(productionMapNodeFromJson), edges: list(row.edges).map(value => {
      const edge = requiredObject(value); return { from: string(edge.from), to: string(edge.to), branch: string(edge.branch) };
    }) };
}
export function productionMapProgramFromJson(value: unknown) {
  const row = requiredObject(value);
  return { map_id: string(row.map_id), product_code: string(row.product_code), operations: list(row.operations).map(value => {
    const operation = requiredObject(value), args = operation.args == null ? {} : requiredObject(operation.args);
    return { order: integer(operation.order) ?? 0, node_id: string(operation.node_id), op_code: string(operation.op_code),
      args: Object.fromEntries(Object.entries(args).map(([key, value]) => [key, text(value)])) };
  }) };
}
export function productionMapSavedFromJson(value: unknown) {
  const row = requiredObject(value), creator = object(row.created_by);
  return { map: productionMapDefinitionFromJson(row.map), program: productionMapProgramFromJson(row.program),
    created_at_unix: integer(row.created_at_unix),
    created_by: creator ? { role: string(creator.role).trim(), ref: string(creator.ref).trim(),
      display_name: string(creator.display_name).trim() } : null, qolip_in_rework: row.qolip_in_rework === true };
}

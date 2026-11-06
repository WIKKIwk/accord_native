/** V2 GScaleModeArgs, encoded as Expo Router string parameters. */
export type GScaleModeArgs = {
  order?: { id: string; code: string; title: string; order_kg: string; saved: boolean; width_mm?: number | null } | null;
  warehouse?: string | null; materialId?: string | null; materialName?: string | null;
  formulaVariantId?: string; freshForm?: boolean;
};
type Params = Record<string, string | string[] | undefined>;

/** @v2 GScaleModeArgs */
export function serializeGScaleModeArgs(args: GScaleModeArgs): Record<string, string> {
  return { ...(args.order ? { order: JSON.stringify(args.order) } : {}), ...(args.warehouse != null ? { warehouse: args.warehouse } : {}),
    ...(args.materialId != null ? { materialId: args.materialId } : {}), ...(args.materialName != null ? { materialName: args.materialName } : {}),
    ...(args.formulaVariantId ? { formulaVariantId: args.formulaVariantId } : {}), ...(args.freshForm ? { freshForm: 'true' } : {}) };
}

export function parseGScaleModeArgs(params: Params): GScaleModeArgs {
  // The Android preparation routes currently wrap their arguments in `data`.
  // Normalize that existing route shape before using the same parser as iOS.
  if (typeof params.data === 'string') {
    const data: unknown = JSON.parse(params.data);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid GScale arguments');
    const row = data as Record<string, unknown>, normalized: Params = {};
    for (const key of ['warehouse', 'materialId', 'materialName', 'formulaVariantId'] as const) {
      if (row[key] != null) {
        if (typeof row[key] !== 'string') throw new TypeError('Invalid GScale arguments');
        normalized[key] = row[key] as string;
      }
    }
    if (row.order != null) normalized.order = JSON.stringify(row.order);
    if (row.freshForm != null) {
      if (typeof row.freshForm !== 'boolean') throw new TypeError('Invalid GScale arguments');
      normalized.freshForm = String(row.freshForm);
    }
    return parseGScaleModeArgs(normalized);
  }
  const string = (key: string): string | undefined => typeof params[key] === 'string' ? params[key] as string : undefined;
  let order: GScaleModeArgs['order'] = null;
  const rawOrder = string('order');
  if (rawOrder) {
    const value: unknown = JSON.parse(rawOrder);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid GScale order');
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.order_kg !== 'string' || (row.code != null && typeof row.code !== 'string') ||
        (row.title != null && typeof row.title !== 'string')) throw new TypeError('Invalid GScale order');
    const widthText = row.width_mm == null ? '' : String(row.width_mm).trim();
    const width = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(widthText) ? Number(widthText) : null;
    order = { id: row.id, code: row.code as string ?? '', title: row.title as string ?? '', order_kg: row.order_kg,
      saved: row.saved === true, width_mm: width };
  }
  return { order, warehouse: string('warehouse') ?? null, materialId: string('materialId') ?? null,
    materialName: string('materialName') ?? null, formulaVariantId: string('formulaVariantId') ?? '', freshForm: string('freshForm') === 'true' };
}

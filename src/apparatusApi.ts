import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value);
function integer(value: unknown, fallback: number | null = null): number | null {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid apparatus number');
  return Math.trunc(value);
}

export type ApparatusCapabilityProfile = { code: string; level: number; valid_from_unix: number | null;
  valid_to_unix: number | null; enabled: boolean };

const apparatusFamilies: Record<string, string> = { print: 'pechat', laminate: 'laminatsiya', cut: 'rezka', package: 'paket', glue: 'kley' };
const apparatusKinds: Record<string, string> = { rotogravure: 'color_pechat', flexographic: 'flexo', adhesive_lamination: 'laminatsiya',
  extrusion_lamination: 'extruder_laminatsiya', slitting: 'rezka', bag_making: 'paket', cold_glue: 'holodniy_kley' };

/** Looks up a caller-normalized canonical key without inherited object properties. */
export function apparatusFamilyForNormalizedOperation(operation: string): string {
  return Object.hasOwn(apparatusFamilies, operation) ? apparatusFamilies[operation] : 'other';
}

/** Looks up a caller-normalized canonical key without inherited object properties. */
export function apparatusKindForNormalizedTechnology(technology: string): string {
  return Object.hasOwn(apparatusKinds, technology) ? apparatusKinds[technology] : 'other';
}

export type AdminApparatus = { id: string; name: string; source: 'canonical'; sort_order: number; family: string; kind: string;
  capabilities: string[]; capability_profiles: ApparatusCapabilityProfile[]; color_stations: number | null;
  factory_map_object_id: string; training_enabled: boolean; source_revision: number; source_aasx_sha256: string;
  description: string; equipment_class_id: string; physical_asset_id: string; enterprise_id: string; site_id: string;
  area_id: string; work_center_id: string; work_unit_id: string; operation: string; technology: string;
  min_web_width_mm: number | null; max_web_width_mm: number | null; virtual_tasks: string;
  capability_compatible_reroute: boolean; training_queue_enabled: boolean; training_material_tracking_enabled: boolean;
  lifecycle_state: string; worker_material_assignment_allowed: boolean };

export function apparatusFromJson(raw: unknown): AdminApparatus {
  const wrapper = object(raw);
  if (!wrapper) throw new TypeError('Invalid apparatus projection');
  const projection = object(wrapper.runtime_projection) ?? wrapper;
  const display = object(projection.display) ?? {}, hierarchy = object(projection.hierarchy) ?? {};
  const execution = object(projection.execution_profile) ?? {}, placement = object(projection.placement) ?? {};
  const training = object(projection.training) ?? {}, lifecycle = object(projection.lifecycle) ?? {};
  const id = text(projection.apparatus_id).trim(), name = text(display.display_name).trim();
  const revision = integer(projection.source_revision, 0)!, sha256 = text(projection.source_aasx_sha256).trim();
  if (!isCanonicalApparatusId(id) || !name || revision < 1 || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new TypeError('Canonical apparatus identity, display and source metadata are required');
  }
  const profiles: ApparatusCapabilityProfile[] = [];
  if (Array.isArray(projection.capabilities)) {
    for (const value of projection.capabilities) {
      const profile = object(value);
      if (!profile) continue;
      const code = text(profile.code).trim().toLowerCase();
      if (code) profiles.push({ code, level: integer(profile.level, 1)!, valid_from_unix: integer(profile.valid_from_unix),
        valid_to_unix: integer(profile.valid_to_unix), enabled: profile.enabled !== false });
    }
  } else {
    const values = object(projection.capabilities);
    if (values) for (const [key, value] of Object.entries(values)) {
      const code = key.trim().toLowerCase();
      const level = integer(value, 1)!;
      if (code) profiles.push({ code, level, valid_from_unix: null, valid_to_unix: null, enabled: true });
    }
  }
  profiles.sort((left, right) => left.code < right.code ? -1 : left.code > right.code ? 1 : 0);
  const operation = text(execution.operation).trim(), technology = text(execution.technology).trim();
  if (!operation || !technology) throw new TypeError('Canonical apparatus execution profile is required');
  return { id, name, source: 'canonical', worker_material_assignment_allowed: projection.worker_material_assignment_allowed === true,
    sort_order: integer(display.catalog_order, null) ?? integer(projection.sort_order, 10000)!,
    family: apparatusFamilies[operation.toLowerCase()] ?? 'other', kind: apparatusKinds[technology.toLowerCase()] ?? 'other',
    capabilities: profiles.map(profile => profile.code), capability_profiles: profiles,
    color_stations: integer(execution.color_station_count), factory_map_object_id: text(placement.factory_map_object_id).trim(),
    training_enabled: training.enabled === true, source_revision: revision, source_aasx_sha256: sha256,
    description: text(display.description), equipment_class_id: text(projection.equipment_class_id).trim(),
    physical_asset_id: text(projection.physical_asset_id).trim(), enterprise_id: text(hierarchy.enterprise_id).trim(),
    site_id: text(hierarchy.site_id).trim(), area_id: text(hierarchy.area_id).trim(),
    work_center_id: text(hierarchy.work_center_id).trim(), work_unit_id: text(hierarchy.work_unit_id).trim(), operation, technology,
    min_web_width_mm: integer(execution.min_web_width_mm), max_web_width_mm: integer(execution.max_web_width_mm),
    virtual_tasks: execution.virtual_tasks == null ? 'disabled' : text(execution.virtual_tasks).trim(),
    capability_compatible_reroute: execution.capability_compatible_reroute === true,
    training_queue_enabled: training.queue_enabled === true, training_material_tracking_enabled: training.material_tracking_enabled === true,
    lifecycle_state: lifecycle.state == null ? (projection.active === false ? 'retired' : 'active') : text(lifecycle.state).trim() };
}

export function apparatusToJson(value: AdminApparatus): Obj {
  return { apparatus_id: value.id, ...(value.worker_material_assignment_allowed ? { worker_material_assignment_allowed: true } : {}),
    source_revision: value.source_revision, source_aasx_sha256: value.source_aasx_sha256,
    display: { display_name: value.name, description: value.description, catalog_order: value.sort_order },
    equipment_class_id: value.equipment_class_id, physical_asset_id: value.physical_asset_id,
    hierarchy: { enterprise_id: value.enterprise_id, site_id: value.site_id, area_id: value.area_id,
      work_center_id: value.work_center_id, work_unit_id: value.work_unit_id },
    capabilities: Object.fromEntries(value.capability_profiles.map(profile => [profile.code, profile.level])),
    execution_profile: { operation: value.operation, technology: value.technology, color_station_count: value.color_stations,
      ...(value.min_web_width_mm != null ? { min_web_width_mm: value.min_web_width_mm } : {}),
      ...(value.max_web_width_mm != null ? { max_web_width_mm: value.max_web_width_mm } : {}),
      virtual_tasks: value.virtual_tasks, capability_compatible_reroute: value.capability_compatible_reroute },
    placement: value.factory_map_object_id.trim() ? { factory_map_object_id: value.factory_map_object_id.trim() } : null,
    training: { enabled: value.training_enabled, queue_enabled: value.training_queue_enabled,
      material_tracking_enabled: value.training_material_tracking_enabled },
    lifecycle: { state: value.lifecycle_state, retirement_reason: null } };
}

export function copyApparatus(value: AdminApparatus, changes: Partial<AdminApparatus>): AdminApparatus {
  return { ...value, ...Object.fromEntries(Object.entries(changes).filter(([, item]) => item != null)) };
}

export function apparatusCapabilityValidAt(profile: ApparatusCapabilityProfile, unixSeconds: number): boolean {
  return profile.enabled && (profile.valid_from_unix == null || unixSeconds >= profile.valid_from_unix) &&
    (profile.valid_to_unix == null || unixSeconds < profile.valid_to_unix);
}

export function apparatusUsesLaminationWorkflow(operation: string): boolean {
  return ['laminate', 'glue'].includes(operation.trim().toLowerCase());
}

class ReadTimeout extends Error {}
class ApparatusException extends WorkerControlException {
  constructor(code: string, message: string, statusCode?: number, readonly details: string[] = []) {
    super(code, message, statusCode);
  }
}
async function readAttempt(session: Session, path: string, timeoutMs: number, signal?: AbortSignal, beforeSend?: () => void) {
  beforeSend?.();
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = beforeSend ? await authorizedFetch(session, path, { signal: controller.signal }, beforeSend)
          : await authorizedFetch(session, path, { signal: controller.signal });
        beforeSend?.();
        const body = await response.text();
        beforeSend?.();
        return { response, body };
      })(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ReadTimeout('API read attempt timed out')); }, timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function readApparatus(session: Session, path: string, retryTransient: boolean, signal?: AbortSignal, beforeSend?: () => void) {
  const start = Date.now(), attempts = retryTransient ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    beforeSend?.();
    const remaining = retryTransient ? 15_000 - (Date.now() - start) : 10_000;
    if (remaining <= 0) throw new ReadTimeout('API read deadline exceeded');
    try {
      const result = await readAttempt(session, path, Math.min(10_000, remaining), signal, beforeSend);
      beforeSend?.();
      if (!retryTransient) return result;
      const contentType = result.response.headers.get('content-type')?.toLowerCase() ?? '';
      const html = result.response.status >= 200 && result.response.status < 300 &&
        (contentType.includes('text/html') || (!contentType && /^\s*<(?:!doctype\s+html|html)[\s>]/i.test(result.body)));
      if (html && attempt === attempts - 1) throw new TypeError('API returned HTML instead of data');
      if (!html && ![502, 503, 504].includes(result.response.status)) return result;
      if (!html && attempt === attempts - 1) return result;
    } catch (error) {
      beforeSend?.();
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const terminal = signal?.aborted || /require https|too many api redirects|certificate|handshake/.test(message);
      const transient = error instanceof ReadTimeout || error instanceof TypeError ||
        /network request failed|connection reset|connection closed|connection aborted|failed host lookup/.test(message);
      if (attempt === attempts - 1 || terminal || !transient) throw error;
    }
    if (15_000 - (Date.now() - start) <= 150) throw new ReadTimeout('API read deadline exceeded');
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('API read attempts exhausted');
}

/** @v2 adminApparatus */
export async function adminApparatus(session: Session, options: { query?: string; limit?: number; retryTransient?: boolean;
  signal?: AbortSignal; beforeSend?: () => void } = {}): Promise<AdminApparatus[]> {
  const query = new URLSearchParams(), value = (options.query ?? '').trim(), limit = options.limit ?? 50;
  if (value) query.set('q', value);
  if (limit > 0) query.set('limit', String(limit));
  await Promise.resolve();
  options.beforeSend?.();
  const { response, body } = await readApparatus(session, `/v1/mobile/admin/apparatus?${query}`, options.retryTransient === true, options.signal, options.beforeSend);
  options.beforeSend?.();
  if (response.status !== 200) {
    let payload: Obj | null = null;
    try { payload = object(JSON.parse(body)); } catch { /* Use the fallback error. */ }
    const serverCode = typeof payload?.error === 'string' ? payload.error.trim() : '';
    const code = serverCode || 'apparatus_list_failed';
    const messages: Record<string, string> = { aasx_integrity_failed: 'Aparat AASX ma’lumotlari tekshirilmadi',
      apparatus_persistence_failed: 'Aparatlar bazadan yuklanmadi', apparatus_cutover_blocked: 'Aparatlar canonical ma’lumotlari tayyor emas',
      apparatus_projection_invalid: 'Aparat ma’lumotlari formati noto‘g‘ri', warehouse_assignee_not_allowed: 'Bu rolga ombor biriktirishga server ruxsat bermadi',
      'worker phone already exists': 'Bu telefon raqami boshqa ishchiga biriktirilgan', 'worker not found': 'Ishchi topilmadi', 'worker store failed': 'Ishchi telefoni bazaga saqlanmadi' };
    const message = serverCode ? messages[code.toLowerCase()] ?? code : `Aparatlar yuklanmadi (HTTP ${response.status})`;
    const details = code === 'rezka_worker_has_open_run' && Array.isArray(payload?.blocked_apparatus_ids)
      ? payload.blocked_apparatus_ids.filter((item): item is string => typeof item === 'string') : [];
    options.beforeSend?.();
    throw new ApparatusException(code, message, response.status, details);
  }
  const decoded: unknown = JSON.parse(body);
  if (!Array.isArray(decoded)) throw new TypeError('Apparatus response must be a list');
  const result = decoded.map((item, index) => {
    try { return apparatusFromJson(item); }
    catch (error) {
      const message = `Canonical apparat projection noto‘g‘ri (${index + 1}-qator)`;
      throw new ApparatusException('apparatus_projection_invalid', message, undefined,
        [`item_index=${index + 1}`, ...(object(item) ? [`error=${String(error)}`] : [])]);
    }
  });
  options.beforeSend?.();
  return result;
}

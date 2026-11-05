import { isCanonicalApparatusId } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const typedString = (value: unknown) => { if (value == null) return ''; if (typeof value !== 'string') throw new TypeError('Invalid profile string'); return value; };
const typedList = (value: unknown): unknown[] => { if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid profile list'); return value; };
const roleNames = new Set(['supplier', 'werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi', 'tayyorlov_masteri', 'material_taminotchi', 'admin', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master']);
export class MobileLoginException extends Error { constructor(readonly statusCode: number) { super(`Login failed (${statusCode})`); } }

export function profileFromLogin(payload: Obj) {
  const source = object(payload.profile); if (!source) throw new TypeError('Invalid profile');
  const role = typedString(source.role).trim().toLowerCase(), normalizedRole = role === 'omborchi' ? 'werka' : role;
  if (!roleNames.has(normalizedRole)) throw new TypeError(`Unsupported user role: ${role}`);
  const strings = (value: unknown) => typedList(value).map(typedString);
  const apparatus = typedList(payload.assigned_apparatus).map(value => String(value).trim());
  if (apparatus.some(id => !isCanonicalApparatusId(id))) throw new TypeError('Canonical apparatus ID list is invalid');
  const warehouses = Array.isArray(payload.assigned_warehouses) ? payload.assigned_warehouses : source.assigned_warehouses;
  return { role: normalizedRole, display_name: typedString(source.display_name), legal_name: typedString(source.legal_name),
    ref: typedString(source.ref), phone: typedString(source.phone), avatar_url: typedString(source.avatar_url),
    capabilities: strings(payload.capabilities), assigned_apparatus: [...new Set(apparatus)],
    assigned_apparatus_labels: typedList(payload.assigned_apparatus_labels).map(value => String(value).trim()).filter(Boolean),
    assigned_item_groups: strings(payload.assigned_item_groups),
    assigned_warehouses: typedList(warehouses).map(value => String(value)).filter(value => !!value.trim()) };
}
export function werkaHomeFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid Werka home');
  const summary = object(row.summary) ?? {};
  const count = (value: unknown) => { if (value == null) return 0; if (!Number.isInteger(value)) throw new TypeError('Invalid summary count'); return value; };
  const fields = ['id', 'record_type', 'supplier_ref', 'supplier_name', 'item_code', 'item_name', 'uom', 'currency', 'note', 'event_type', 'highlight', 'created_label'];
  const pendingItems = typedList(row.pending_items).map(value => {
    const item = object(value); if (!item) throw new TypeError('Invalid dispatch');
    const record: Obj = {};
    for (const key of fields) record[key] = typedString(item[key]);
    for (const key of ['sent_qty', 'accepted_qty', 'amount']) {
      if (item[key] != null && typeof item[key] !== 'number') throw new TypeError('Invalid dispatch quantity');
      record[key] = item[key] ?? 0;
    }
    const status = typedString(item.status).trim().toLowerCase();
    record.status = ['accepted', 'partial', 'rejected', 'cancelled', 'draft'].includes(status) ? status : 'pending';
    return record;
  });
  return { summary: { pending_count: count(summary.pending_count), confirmed_count: count(summary.confirmed_count),
    returned_count: count(summary.returned_count) }, pending_items: pendingItems };
}
function normalizeEndpoint(raw: string) {
  const value = raw.trim();
  let uri: URL;
  try { uri = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new TypeError('API connections require HTTPS'); }
  if (uri.protocol !== 'https:' || !uri.hostname || uri.username || uri.password || uri.search || uri.hash || (uri.pathname !== '/' && uri.pathname !== ''))
    throw new TypeError('API connections require HTTPS');
  return uri.origin;
}
/** @v2 authenticateAccount */
export async function authenticateAccount(baseUrl: string, phone: string, code: string) {
  const server = normalizeEndpoint(baseUrl), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${server}/v1/mobile/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }), signal: controller.signal });
    if (response.status !== 200) throw new MobileLoginException(response.status);
    const payload = object(await response.json());
    if (!payload || typeof payload.token !== 'string' || !payload.token.trim() || !object(payload.profile)) throw new MobileLoginException(response.status);
    const profile = profileFromLogin(payload);
    return { token: payload.token.trim(), profile, werka_home: profile.role === 'werka' && object(payload.werka_home) ? werkaHomeFromJson(payload.werka_home) : null };
  } finally { clearTimeout(timer); }
}

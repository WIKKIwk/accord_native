import type { Session } from '../auth';
import type { AccountStorage } from '../savedAccountStore';

const materialCapabilities = ['gscale.catalog.read', 'gscale.print', 'rps.batch.manage', 'catalog.item.create',
  'raw_material.assign', 'inventory.movement.manage'];
const enumNames: Record<string, string> = { rezka_master: 'rezkaMaster', sales_manager: 'salesManager',
  homashyo_rezkachi: 'homashyoRezkachi', tayyorlov_masteri: 'tayyorlovMasteri', material_taminotchi: 'materialTaminotchi' };
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const normalize = (value: string) => value.trim().toLowerCase();

function accessRole(session: Session): string | null {
  const role = session.profile.role, has = (capability: string) => session.capabilities.includes(capability);
  const special = [['rezka_master', 'rezka.master.access'], ['brigader', 'brigader.access'],
    ['sales_manager', 'sales.access'], ['homashyo_rezkachi', 'raw_material.split'],
    ['tayyorlov_masteri', 'preparation.access']];
  for (const [candidate, capability] of special) if (role === candidate && has(capability)) return enumNames[candidate] ?? candidate;
  for (const [capability, candidate] of [['admin.access', 'admin'], ['werka.access', 'werka'],
    ['supplier.access', 'supplier'], ['customer.access', 'customer'], ['boyoqchi.access', 'boyoqchi']]) {
    if (has(capability)) return candidate;
  }
  if (role === 'material_taminotchi' && materialCapabilities.some(has)) return 'materialTaminotchi';
  return null;
}

/** @v2 SearchActivityStore */
export class SearchActivityStore {
  private scope = '';
  private counts: Record<string, number> = {};
  constructor(private readonly storage: AccountStorage) {}

  private async load(session: Session | null) {
    const scope = session ? `${accessRole(session) ?? 'custom'}:${String(session.profile.ref ?? '').trim().toLowerCase()}` : 'guest';
    if (this.scope === scope) return;
    this.scope = scope;
    const raw = await this.storage.getItem(`search_item_activity_v1:${scope}`);
    this.counts = {};
    if (!raw?.trim()) return;
    try {
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const parsed: Record<string, number> = {};
      for (const [key, value] of Object.entries(data)) {
        const normalized = normalize(key);
        if (value != null && typeof value !== 'number') throw new TypeError('Invalid search activity count');
        const count = value == null ? 0 : Math.trunc(value);
        if (normalized && count > 0) parsed[normalized] = count;
      }
      this.counts = parsed;
    } catch { this.counts = {}; }
  }

  async recordItemSelections(session: Session | null, codes: Iterable<string>): Promise<void> {
    await this.load(session);
    let changed = false;
    for (const code of codes) {
      const key = normalize(code);
      if (!key) continue;
      this.counts[key] = (this.counts[key] ?? 0) + 1;
      changed = true;
    }
    if (!changed) return;
    const entries = Object.entries(this.counts);
    if (entries.length > 200) {
      entries.sort(([left, lc], [right, rc]) => rc - lc || compare(left, right));
      this.counts = Object.fromEntries(entries.slice(0, 200));
    }
    await this.storage.setItem(`search_item_activity_v1:${this.scope}`, JSON.stringify(this.counts));
  }

  async sortByItemCode<T>(session: Session | null, items: Iterable<T>, itemCode: (item: T) => string,
    fallback: (left: T, right: T) => number): Promise<T[]> {
    await this.load(session);
    return [...items].sort((left, right) => (this.counts[normalize(itemCode(right))] ?? 0)
      - (this.counts[normalize(itemCode(left))] ?? 0) || fallback(left, right));
  }
}

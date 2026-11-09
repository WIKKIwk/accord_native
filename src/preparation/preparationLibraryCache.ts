import type { preparationFormulaCatalogEntryFromJson, preparationFormulaSetFromJson } from './preparationModel';

export type PreparationLibraryData = {
  sets: ReturnType<typeof preparationFormulaSetFromJson>[];
  recipes: ReturnType<typeof preparationFormulaCatalogEntryFromJson>[];
};
type Mode = 'sets' | 'catalog';
type Entry = { scope: string; data: PreparationLibraryData | null; savedAt: number; revision: number; savedRevision: number;
  pending?: { revision: number; promise: Promise<PreparationLibraryData> } };

function retainRows<T>(previous: T[] | undefined, incoming: T[], key: (row: T) => string): T[] {
  const byId = new Map(previous?.map(row => [key(row), row]));
  const rows = incoming.map(row => {
    const before = byId.get(key(row));
    return before && JSON.stringify(before) === JSON.stringify(row) ? before : row;
  });
  return previous?.length === rows.length && rows.every((row, index) => row === previous[index]) ? previous : rows;
}
function retainData(previous: PreparationLibraryData | null, incoming: PreparationLibraryData): PreparationLibraryData {
  const sets = retainRows(previous?.sets, incoming.sets, row => row.set_id);
  const recipes = retainRows(previous?.recipes, incoming.recipes, row => JSON.stringify([row.product_code, row.material_id, row.id]));
  return previous && sets === previous.sets && recipes === previous.recipes ? previous : { sets, recipes };
}

/** Scoped, in-memory cache. Mutations invalidate freshness without discarding visible rows. */
export class PreparationLibraryCache {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly now: () => number = Date.now, private readonly maxAge = 60_000) {}
  private key(scope: string, mode: Mode) { return JSON.stringify([scope, mode]); }
  peek(scope: string, mode: Mode) { return this.entries.get(this.key(scope, mode))?.data ?? null; }
  isFresh(scope: string, mode: Mode) {
    const entry = this.entries.get(this.key(scope, mode));
    const age = entry ? this.now() - entry.savedAt : Infinity;
    return !!entry?.data && entry.savedRevision === entry.revision && age >= 0 && age < this.maxAge;
  }
  read(scope: string, mode: Mode, load: () => Promise<PreparationLibraryData>, force = false): Promise<PreparationLibraryData> {
    const key = this.key(scope, mode);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { scope, data: null, savedAt: 0, revision: 0, savedRevision: -1 };
      this.entries.set(key, entry);
      while (this.entries.size > 8) this.entries.delete(this.entries.keys().next().value!);
    }
    if (!force && this.isFresh(scope, mode)) return Promise.resolve(entry.data!);
    const revision = entry.revision;
    if (entry.pending?.revision === revision) return entry.pending.promise;
    const target = entry;
    let promise: Promise<PreparationLibraryData>;
    promise = load().then(data => {
      if (this.entries.get(key) !== target) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      // A write completed during the read: never publish its older response.
      if (target.revision !== revision) return this.read(scope, mode, load, true);
      target.data = retainData(target.data, data);
      target.savedAt = this.now(); target.savedRevision = revision;
      return target.data;
    }).finally(() => { if (target.pending?.promise === promise) target.pending = undefined; });
    target.pending = { revision, promise };
    return promise;
  }
  patch(scope: string, mode: Mode, data: PreparationLibraryData) {
    const entry = this.entries.get(this.key(scope, mode));
    if (entry) entry.data = retainData(entry.data, data);
  }
  invalidate(scope: string) { for (const entry of this.entries.values()) if (entry.scope === scope) entry.revision++; }
  clear(scope?: string) {
    if (scope === undefined) this.entries.clear();
    else for (const [key, entry] of this.entries) if (entry.scope === scope) this.entries.delete(key);
  }
}

export const preparationLibraryCache = new PreparationLibraryCache();

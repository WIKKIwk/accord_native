import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook } from '../auth';
import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { preparationFormulaCatalog, preparationFormulaSets, preparationRenameFormulaSet, preparationRenameFormulaVariant } from './preparationFormulaApi';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationLibraryCache } from './preparationLibraryCache';
import { WorkerControlException } from '../workerControlsApi';

registerSessionResetHook(async () => { preparationLibraryCache.clear(); });

export function readPreparationLibrary(session: Session, mode: 'sets' | 'catalog', force = true) {
  const scope = sessionReadScope(session);
  return preparationLibraryCache.read(scope, mode, async () => {
    if (scope !== sessionReadScope(session)) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
    const [sets, recipes] = await Promise.all([
      mode === 'sets' ? preparationFormulaSets(session) : Promise.resolve([]), preparationFormulaCatalog(session),
    ]);
    if (scope !== sessionReadScope(session)) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
    return { sets, recipes };
  }, force);
}

type SetItem = Awaited<ReturnType<typeof preparationFormulaSets>>[number];
type Recipe = Awaited<ReturnType<typeof preparationFormulaCatalog>>[number];
type State = { sets: SetItem[]; recipes: Recipe[]; query: string; loading: boolean; busy: boolean; error: string | null };
export function preparationVariantName(value: string) { return value.trim().split(/\s+/u).filter(Boolean).join(' '); }
export function preparationVariantNameCanSave(value: string, initial?: string | null) {
  const normalized = preparationVariantName(value);
  return !!normalized && [...normalized].length <= 160 && normalized !== initial;
}
export class PreparationLibraryState {
  private state: State = { sets: [], recipes: [], query: '', loading: true, busy: false, error: null };
  private active = true;
  private invalidated = false;
  private generation = 0;
  private read: Promise<void> | null = null;
  private readonly scope: string;
  private listeners = new Set<() => void>();
  constructor(private readonly session: Session, private readonly mode: 'sets' | 'catalog') {
    this.scope = sessionReadScope(session);
    const cached = preparationLibraryCache.peek(this.scope, mode);
    if (cached) this.state = { ...this.state, ...cached, loading: false };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private get current() { return this.active && !this.invalidated && this.scope === sessionReadScope(this.session); }
  private update(patch: Partial<State>) {
    if (this.active && Object.entries(patch).some(([key, value]) => !Object.is(this.state[key as keyof State], value))) {
      this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
    }
  }
  activate() { if (!this.active && !this.invalidated) { this.active = true; this.update({ loading: !preparationLibraryCache.peek(this.scope, this.mode), busy: false }); } }
  setQuery(query: string) { this.update({ query }); }
  get filteredSets() {
    const query = this.state.query.trim().toLowerCase();
    return this.state.sets.filter(item => `${item.set_id} ${item.name} ${item.product_title} ${item.product_code} ${item.order_codes.join(' ')}`.toLowerCase().includes(query));
  }
  get filteredRecipes() {
    const query = this.state.query.trim().toLowerCase();
    return this.state.recipes.filter(item => [item.name, item.formula_code, item.material_name, item.set_name, item.product_title,
      item.product_code, ...item.order_codes].join(' ').toLowerCase().includes(query));
  }
  recipesFor(set: SetItem) { return this.state.recipes.filter(item => item.product_code === set.product_code); }
  recipeCount(set: SetItem) { return this.recipesFor(set).length + set.formulas.filter(item => !item.variant_id).length; }
  sessionChanged(force = false) {
    if ((!force && this.current) || !this.active) return;
    this.invalidated = true;
    preparationLibraryCache.clear(this.scope);
    this.generation++; this.update({ sets: [], recipes: [], loading: false, error: 'Akkaunt o‘zgargan. Sahifani qayta oching' });
  }
  load(force = true): Promise<void> {
    if (this.state.busy || !this.current) return Promise.resolve();
    if (this.read) return this.read;
    const cached = preparationLibraryCache.peek(this.scope, this.mode);
    if (!force && cached && preparationLibraryCache.isFresh(this.scope, this.mode)) {
      this.update({ ...cached, loading: false, error: null }); return Promise.resolve();
    }
    const generation = this.generation;
    this.update({ loading: !cached, error: null });
    let pending: Promise<void>;
    pending = (async () => {
      try {
        const data = await readPreparationLibrary(this.session, this.mode, force);
        if (this.current && generation === this.generation) this.update(data);
      } catch (error) {
        if (this.current && generation === this.generation) {
          const denied = error instanceof WorkerControlException && [401, 403].includes(error.statusCode ?? 0);
          if (denied) preparationLibraryCache.clear(this.scope);
          this.update({ error: preparationFormulaErrorMessage(error), ...(denied ? { sets: [], recipes: [] } : {}) });
        }
      } finally { if (this.active && generation === this.generation) this.update({ loading: false }); }
    })().finally(() => { if (this.read === pending) this.read = null; });
    this.read = pending; return pending;
  }
  async renameSet(set: SetItem, name: string) {
    if (this.state.loading || this.state.busy || !this.current || name === set.name) return false;
    const generation = this.generation;
    this.update({ busy: true });
    try { const saved = await preparationRenameFormulaSet(this.session, set.set_id, name);
      if (!this.current || generation !== this.generation) return false;
      this.update({ sets: this.state.sets.map(item => item.set_id === set.set_id ? { ...item, name: saved } : item) });
      preparationLibraryCache.patch(this.scope, this.mode, { sets: this.state.sets, recipes: this.state.recipes }); return true; }
    finally { if (generation === this.generation) this.update({ busy: false }); }
  }
  async renameRecipe(recipe: Recipe, name: string) {
    if (this.state.loading || this.state.busy || !this.current || !preparationVariantNameCanSave(name, recipe.name)) return false;
    const generation = this.generation;
    this.update({ busy: true });
    try { await preparationRenameFormulaVariant(this.session, { productCode: recipe.product_code, materialId: recipe.material_id,
      variantId: recipe.id, name: preparationVariantName(name) }); }
    finally { if (generation === this.generation) this.update({ busy: false }); }
    if (!this.current || generation !== this.generation) return false;
    await this.load(); return this.current && generation === this.generation;
  }
  async open(open: () => Promise<void>) {
    if (this.state.loading || this.state.busy || !this.current) return;
    this.update({ busy: true });
    try { await open(); } finally { this.update({ busy: false }); if (this.current) await this.load(false); }
  }
  invalidate() {
    if (!this.active) return;
    this.invalidated = true; preparationLibraryCache.clear(this.scope);
    this.generation++; this.update({ sets: [], recipes: [], query: '', loading: false, busy: false,
      error: 'Akkaunt o‘zgargan. Sahifani qayta oching' }); this.active = false;
  }
  dispose() { this.active = false; this.generation++; this.read = null; this.listeners.clear(); }
}
export function usePreparationLibrary(session: Session, mode: 'sets' | 'catalog') {
  const controller = useMemo(() => new PreparationLibraryState(session, mode), [session, mode]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unsubscribe = registerSessionResetHook(async () => { controller.sessionChanged(true); });
    void controller.load(false);
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  return { ...state, filteredSets: controller.filteredSets, filteredRecipes: controller.filteredRecipes, controller };
}

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook } from '../auth';
import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { preparationFormulaCatalog, preparationFormulaSets, preparationRenameFormulaSet, preparationRenameFormulaVariant } from './preparationFormulaApi';
import { preparationFormulaErrorMessage } from './usePreparationFormula';

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
  private readonly scope: string;
  private listeners = new Set<() => void>();
  constructor(private readonly session: Session, private readonly mode: 'sets' | 'catalog') { this.scope = sessionReadScope(session); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private get current() { return this.active && !this.invalidated && this.scope === sessionReadScope(this.session); }
  private update(patch: Partial<State>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  activate() { if (!this.active) { this.active = true; this.update({ loading: true, busy: false }); } }
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
    this.generation++; this.update({ sets: [], recipes: [], loading: false, error: 'Akkaunt o‘zgargan. Sahifani qayta oching' });
  }
  async load() {
    if (this.state.busy || !this.current) return;
    const generation = this.generation; this.update({ loading: true, error: null });
    try {
      const sets = this.mode === 'sets' ? await preparationFormulaSets(this.session) : [];
      const recipes = await preparationFormulaCatalog(this.session);
      if (this.current && generation === this.generation) this.update({ sets, recipes });
    } catch (error) { if (this.current && generation === this.generation) this.update({ error: preparationFormulaErrorMessage(error) }); }
    finally { if (this.active && generation === this.generation) this.update({ loading: false }); }
  }
  async renameSet(set: SetItem, name: string) {
    if (this.state.loading || this.state.busy || !this.current || name === set.name) return false;
    const generation = this.generation;
    this.update({ busy: true });
    try { const saved = await preparationRenameFormulaSet(this.session, set.set_id, name);
      if (!this.current || generation !== this.generation) return false;
      this.update({ sets: this.state.sets.map(item => item.set_id === set.set_id ? { ...item, name: saved } : item) }); return true; }
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
    try { await open(); } finally { this.update({ busy: false }); if (this.current) await this.load(); }
  }
  invalidate() {
    if (!this.active) return;
    this.generation++; this.update({ sets: [], recipes: [], query: '', loading: false, busy: false,
      error: 'Akkaunt o‘zgargan. Sahifani qayta oching' }); this.active = false;
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
export function usePreparationLibrary(session: Session, mode: 'sets' | 'catalog') {
  const controller = useMemo(() => new PreparationLibraryState(session, mode), [session, mode]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unsubscribe = registerSessionResetHook(async () => { controller.sessionChanged(true); });
    void controller.load();
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  return { ...state, filteredSets: controller.filteredSets, filteredRecipes: controller.filteredRecipes, controller };
}

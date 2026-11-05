import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { preparationDeleteFormula, preparationFormulaCatalog, preparationFormulaSets, preparationUpdateFormulaShares } from './preparationFormulaApi';
import { preparationFormulaShareInputs } from './preparationLogic';
import { preparationFormulaErrorMessage } from './usePreparationFormula';

type SetItem = Awaited<ReturnType<typeof preparationFormulaSets>>[number];
type Recipe = Awaited<ReturnType<typeof preparationFormulaCatalog>>[number];
type Scoped = SetItem['formulas'][number];
type State = { formulas: Scoped[]; recipes: Recipe[]; busy: boolean; error: string | null };
export class PreparationSetDetailState {
  private state: State;
  private active = true;
  private generation = 0;
  private readonly scope: string;
  private listeners = new Set<() => void>();
  constructor(private readonly session: Session, readonly formulaSet: SetItem, recipes: Recipe[]) {
    this.scope = sessionReadScope(session);
    this.state = { formulas: formulaSet.formulas, recipes, busy: false, error: null };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private get current() { return this.active && this.scope === sessionReadScope(this.session); }
  private update(patch: Partial<State>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  get legacyFormulas() { return this.state.formulas.filter(item => !item.variant_id); }
  formulasFor(entry: Scoped) { return this.state.formulas.filter(item => item.material_id === entry.material_id && item.variant_id === entry.variant_id).map(item => item.formula); }
  activate() { this.active = true; }
  async reload() {
    if (!this.current) return;
    const generation = this.generation; this.update({ busy: true, error: null });
    try {
      const sets = await preparationFormulaSets(this.session), recipes = await preparationFormulaCatalog(this.session);
      if (this.current && generation === this.generation) this.update({ formulas: sets.find(item => item.set_id === this.formulaSet.set_id)?.formulas ?? [],
        recipes: recipes.filter(item => item.product_code === this.formulaSet.product_code) });
    } catch (error) { if (this.current && generation === this.generation) this.update({ error: preparationFormulaErrorMessage(error) }); }
    finally { if (this.active && generation === this.generation) this.update({ busy: false }); }
  }
  async openRecipe(open: () => Promise<void>) {
    if (this.state.busy || !this.current) return;
    this.update({ busy: true });
    try { await open(); } finally { if (this.current) await this.reload(); else this.update({ busy: false }); }
  }
  async remove(entry: Scoped) {
    if (this.state.busy || !this.current) return;
    this.update({ busy: true });
    try {
      await preparationDeleteFormula(this.session, this.formulaSet.product_code, entry.formula.name,
        { materialId: entry.material_id, variantId: entry.variant_id, savedOnly: true });
      if (this.current) this.update({ formulas: this.state.formulas.filter(item => item.material_id !== entry.material_id ||
        item.variant_id !== entry.variant_id || item.formula.name !== entry.formula.name) });
    } finally { this.update({ busy: false }); }
  }
  async saveShares(entry: Scoped, values: string[]) {
    if (this.state.busy || !this.current) return;
    const formulas = this.formulasFor(entry);
    this.update({ busy: true });
    try {
      await preparationUpdateFormulaShares(this.session, { productCode: this.formulaSet.product_code, materialId: entry.material_id,
        variantId: entry.variant_id, savedOnly: true, shares: preparationFormulaShareInputs(formulas.map(formula => formula.name), values) });
      if (this.current) await this.reload();
    } finally { this.update({ busy: false }); }
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
export function usePreparationSetDetail(session: Session, formulaSet: SetItem, recipes: Recipe[]) {
  const key = JSON.stringify({ formulaSet, recipes });
  const controller = useMemo(() => { const input = JSON.parse(key) as { formulaSet: SetItem; recipes: Recipe[] };
    return new PreparationSetDetailState(session, input.formulaSet, input.recipes); }, [session, key]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  return { ...state, legacyFormulas: controller.legacyFormulas, controller };
}

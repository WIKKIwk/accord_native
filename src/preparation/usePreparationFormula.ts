import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { preparationOrderMaterials, preparationSnapshot } from '../preparationReadApi';
import { sessionReadScope } from '../sessionReadScope';
import { WorkerControlException } from '../workerControlsApi';
import { preparationDeleteFormula, preparationFormulaDetails, preparationSelectFormulaVariant,
  preparationUpdateFormulaShares, preparationUpsertFormula } from './preparationFormulaApi';
import { preparationFormulaEditorError, preparationFormulaEditorLines, preparationFormulaShareInputs, preparationNextFormulaName,
  type FormulaEditorRow } from './preparationLogic';
import { preparationDecimal, preparationDecimalText, preparationDisplay, type PreparationFormula } from './preparationModel';

type Material = Awaited<ReturnType<typeof preparationSnapshot>>['materials'][number];
export type PreparationFormulaOptions = { orderId: string; orderCode: string; productCode: string; productTitle: string;
  materialId: string; materialName: string; variantId?: string; variantName?: string; manageSavedFormula?: boolean;
  allowAddingFormula?: boolean; initialFormulaName?: string | null; openEditorOnLoad?: boolean };
type FormulaState = { materials: Material[]; formulas: PreparationFormula[]; variantName: string; recipeKey: string | null;
  estimatedMaterialKg: string | null; error: string | null; notice: string | null; loading: boolean; saving: boolean; deleting: boolean;
  openingReceipt: boolean; editing: boolean; editingName: string | null; rows: FormulaEditorRow[] };

/** @v2 preparationFormulaErrorMessage */
export function preparationFormulaErrorMessage(error: unknown): string {
  if (error instanceof WorkerControlException) {
    if (error.statusCode === 403) return 'Bu formulani boshqarish huquqingiz yo‘q';
    if (error.statusCode === 401) return 'Sessiya tugagan. Qayta kiring';
    if (error.statusCode === 400 || error.statusCode === 409 || error.code === 'account_changed' || error.code === 'preparation_invalid_response') return error.message;
  }
  return 'Formulalar bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring';
}
export class PreparationFormulaState {
  private state: FormulaState;
  private readonly scope: string;
  private active = true;
  private generation = 0;
  private initialOpened = false;
  private listeners = new Set<() => void>();
  constructor(private readonly session: Session, private readonly options: PreparationFormulaOptions) {
    this.scope = sessionReadScope(session);
    this.state = { materials: [], formulas: [], variantName: options.variantName ?? '', recipeKey: null, estimatedMaterialKg: null,
      error: null, notice: null, loading: true, saving: false, deleting: false, openingReceipt: false, editing: false, editingName: null, rows: [] };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<FormulaState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private get sameScope() { return this.active && this.scope === sessionReadScope(this.session); }
  private get recipeOrderId() { return this.options.manageSavedFormula || !this.options.variantId ? '' : this.options.orderId; }
  private get query() { return { materialId: this.options.materialId, savedOnly: this.options.manageSavedFormula ?? false,
    variantId: this.options.variantId ?? '', orderId: this.recipeOrderId }; }
  get editorError() { return preparationFormulaEditorError(this.state.rows); }
  get canSave() { return this.state.rows.length > 0 && !this.state.saving && this.editorError === null; }
  activate() { this.active = true; }
  async reload() {
    if (!this.sameScope) return;
    const generation = this.generation; this.update({ loading: true, error: null });
    try {
      const snapshot = await preparationSnapshot(this.session);
      const details = await preparationFormulaDetails(this.session, this.options.productCode, this.query);
      let estimatedMaterialKg: string | null = null;
      if (!this.options.manageSavedFormula) {
        try {
          const materials = await preparationOrderMaterials(this.session, this.options.orderId);
          const kg = materials.find(item => item.material_id.toLowerCase() === this.options.materialId.toLowerCase())?.estimated_kg;
          if (kg != null) estimatedMaterialKg = preparationDecimalText(preparationDecimal(kg));
        } catch { /* V2 lets recipes open without a historical estimate. */ }
      }
      if (!this.sameScope || generation !== this.generation) return;
      const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
      const materials = [...snapshot.materials].sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.code, b.code));
      this.update({ materials, formulas: details.formulas, variantName: details.variant_name as string | null ?? this.state.variantName,
        recipeKey: details.recipe_key as string | null, estimatedMaterialKg });
      if (!this.initialOpened && (this.options.initialFormulaName != null || this.options.openEditorOnLoad)) {
        this.initialOpened = true;
        const formula = this.options.initialFormulaName == null ? details.formulas[0]
          : details.formulas.find(item => item.name === this.options.initialFormulaName);
        if (this.options.initialFormulaName == null || formula) this.openEditor(formula);
        else this.update({ error: 'Formula topilmadi. Ro‘yxatni yangilang' });
      }
    } catch (error) { if (this.sameScope && generation === this.generation) this.update({ error: preparationFormulaErrorMessage(error) }); }
    finally { if (this.sameScope && generation === this.generation) this.update({ loading: false }); }
  }
  async refreshFormulas() {
    if (!this.sameScope) return;
    const generation = this.generation;
    try {
      const details = await preparationFormulaDetails(this.session, this.options.productCode, this.query);
      if (this.sameScope && generation === this.generation) this.update({ formulas: details.formulas,
        variantName: details.variant_name as string | null ?? this.state.variantName, recipeKey: details.recipe_key as string | null });
    } catch (error) {
      if (this.sameScope && generation === this.generation) this.update({ notice: preparationFormulaErrorMessage(error) });
    }
  }
  clearNotice() { this.update({ notice: null }); }
  openEditor(existing?: PreparationFormula) {
    const rows = existing?.lines.length ? existing.lines.map(line => ({ material: this.state.materials.find(item => item.code.trim() === line.item_code.trim())
      ?? { code: line.item_code, name: line.name }, percent: preparationDisplay(line.percent) })) : [{ material: null, percent: '' }];
    this.update({ editing: true, editingName: existing?.name ?? null, rows });
  }
  closeEditor() { this.update({ editing: false, editingName: null, rows: [] }); }
  setRows(rows: FormulaEditorRow[]) { this.update({ rows }); }
  async save() {
    if (!this.canSave || !this.sameScope) return;
    this.update({ saving: true });
    try {
      await preparationUpsertFormula(this.session, this.options.productCode, preparationFormulaEditorLines(this.state.rows), {
        ...this.query, name: this.state.editingName ?? preparationNextFormulaName(this.state.formulas.map(item => item.name)),
        savedOnly: !!this.options.manageSavedFormula && (this.state.editingName !== null || !this.options.allowAddingFormula) });
      if (!this.sameScope) return;
      this.update({ saving: false }); this.closeEditor(); await this.refreshFormulas();
    } finally { this.update({ saving: false }); }
  }
  async remove(name: string) {
    if (this.state.deleting || !this.sameScope) return;
    this.update({ deleting: true });
    try { await preparationDeleteFormula(this.session, this.options.productCode, name, this.query);
      if (this.sameScope) { this.update({ deleting: false }); await this.refreshFormulas(); }
    } finally { this.update({ deleting: false }); }
  }
  async saveShares(values: string[]) {
    if (this.state.loading || this.state.saving || this.state.deleting || !this.sameScope || !this.state.formulas.length) return;
    this.update({ saving: true });
    try {
      const formulas = await preparationUpdateFormulaShares(this.session, { ...this.query, productCode: this.options.productCode,
        shares: preparationFormulaShareInputs(this.state.formulas.map(value => value.name), values) });
      if (this.sameScope) { this.update({ formulas }); if (this.recipeOrderId) await this.refreshFormulas(); }
    } finally { this.update({ saving: false }); }
  }
  async startProduction(canOpenScale: boolean, open: (args: { order: { id: string; code: string; title: string; order_kg: string; saved: boolean };
    materialId: string; materialName: string; formulaVariantId: string; freshForm: boolean }) => Promise<void>) {
    if (this.state.loading || this.state.saving || this.state.deleting || this.state.openingReceipt || !this.sameScope ||
      this.options.manageSavedFormula || !canOpenScale || !this.options.orderId.trim() || !this.options.materialId.trim()) return null;
    this.update({ openingReceipt: true });
    try {
      if (this.recipeOrderId) {
        const selected = await preparationSelectFormulaVariant(this.session, { productCode: this.options.productCode,
          materialId: this.options.materialId, variantId: this.options.variantId ?? '', orderId: this.recipeOrderId, recipeKey: this.state.recipeKey });
        if (!this.sameScope) return null;
        this.update({ variantName: selected.name });
      }
      const args = { order: { id: this.options.orderId, code: this.options.orderCode, title: this.options.productTitle, order_kg: '0', saved: false },
        materialId: this.options.materialId, materialName: this.options.materialName, formulaVariantId: this.options.variantId ?? '', freshForm: true };
      await open(args);
      return args;
    } catch (error) {
      if (error instanceof WorkerControlException && error.statusCode === 409 && this.sameScope) await this.refreshFormulas();
      throw error;
    } finally { this.update({ openingReceipt: false }); }
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
export function usePreparationFormula(session: Session, options: PreparationFormulaOptions) {
  const key = JSON.stringify(options);
  const controller = useMemo(() => new PreparationFormulaState(session, JSON.parse(key) as PreparationFormulaOptions), [session, key]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); void controller.reload(); return () => controller.dispose(); }, [controller]);
  return { ...state, editorError: controller.editorError, canSave: controller.canSave, controller };
}

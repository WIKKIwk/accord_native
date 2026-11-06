import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { searchMatches } from '../shared/searchNormalizer';
import { newPreparationRequestId } from './preparationCommandApi';
import { preparationCreateFormulaVariant, preparationFormulaCatalog, preparationFormulaVariants, preparationRemoveFormulaVariantFromOrder,
  preparationRenameFormulaVariant, preparationReuseFormulaVariant } from './preparationFormulaApi';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationVariantName, preparationVariantNameCanSave } from './usePreparationLibrary';

type Variant = Awaited<ReturnType<typeof preparationFormulaVariants>>[number];
type CatalogEntry = Awaited<ReturnType<typeof preparationFormulaCatalog>>[number];
export function preparationReuseSubtitle(entry: CatalogEntry): string {
  return [entry.formula_code || null, entry.material_name, entry.product_title,
    entry.set_name && entry.set_name !== entry.product_title ? entry.set_name : null, entry.product_code,
    entry.order_codes.length ? `Buyurtmalar: ${entry.order_codes.join(', ')}` : null]
    .filter((value): value is string => value !== null).join(' • ');
}
export type PreparationVariantsOptions = { orderId: string; productCode: string; materialId: string };
type State = { variants: Variant[]; loading: boolean; creating: boolean; opening: boolean; copying: boolean; removing: boolean;
  savingName: boolean; requestId: string | null; nameError: string | null; error: string | null };
export class PreparationVariantsState {
  private state: State = { variants: [], loading: true, creating: false, opening: false, copying: false, removing: false,
    savingName: false, requestId: null, nameError: null, error: null };
  private active = true;
  private generation = 0;
  private catalogRequest: Promise<CatalogEntry[]> | null = null;
  private readonly scope: string;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly session: Session, private readonly options: PreparationVariantsOptions) { this.scope = sessionReadScope(session); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private get current() { return this.active && this.scope === sessionReadScope(this.session); }
  private update(patch: Partial<State>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  activate() { if (!this.active) { this.active = true; this.update({ loading: true, creating: false, opening: false, copying: false, removing: false, savingName: false }); } }
  async load() {
    if (!this.current || this.state.removing) return;
    const generation = this.generation; this.update({ loading: true, error: null });
    try {
      const variants = await preparationFormulaVariants(this.session, this.options);
      if (this.current && generation === this.generation) this.update({ variants });
    } catch (error) { if (this.current && generation === this.generation) this.update({ error: preparationFormulaErrorMessage(error) }); }
    finally { if (this.active && generation === this.generation) this.update({ loading: false }); }
  }
  async beginCreate() {
    if (this.state.creating || this.state.opening || this.state.removing || !this.current) return null;
    const generation = this.generation; this.update({ creating: true, nameError: null });
    try {
      const requestId = await newPreparationRequestId();
      if (!this.current || generation !== this.generation) return null;
      this.update({ requestId }); return requestId;
    } catch (error) { if (this.current) this.update({ creating: false, nameError: preparationFormulaErrorMessage(error) }); return null; }
  }
  cancelCreate() { if (!this.state.savingName) this.update({ creating: false, requestId: null, nameError: null }); }
  async create(name: string): Promise<Variant | null> {
    const requestId = this.state.requestId;
    if (!this.current || !this.state.creating || this.state.savingName || !requestId || !preparationVariantNameCanSave(name)) return null;
    this.update({ savingName: true, nameError: null });
    try {
      const variant = await preparationCreateFormulaVariant(this.session, { ...this.options, name: preparationVariantName(name), requestId });
      if (!this.current) return null;
      this.update({ creating: false, requestId: null, variants: this.state.variants.some(item => item.id === variant.id)
        ? this.state.variants : [...this.state.variants, variant] });
      return variant;
    } catch (error) { if (this.current) this.update({ nameError: preparationFormulaErrorMessage(error) }); return null; }
    finally { this.update({ savingName: false }); }
  }
  async open(variant: Variant, open: (variant: Variant) => Promise<void>) {
    if (this.state.opening || !this.current) return;
    this.update({ opening: true });
    try { await open(variant); } finally { this.update({ opening: false }); if (this.current) await this.load(); }
  }
  beginReuse() {
    if (this.state.creating || this.state.opening || this.state.removing || !this.current) return false;
    this.catalogRequest = null; this.update({ creating: true }); return true;
  }
  cancelReuse() { if (!this.state.copying) { this.catalogRequest = null; this.update({ creating: false }); } }
  async loadReusePage(query: string, offset: number, limit: number): Promise<CatalogEntry[]> {
    if (!this.current || !this.state.creating) throw new Error('Akkaunt o‘zgargan');
    const request = this.catalogRequest ??= preparationFormulaCatalog(this.session, this.options);
    try {
      const entries = await request;
      if (!this.current || !this.state.creating || this.catalogRequest !== request) throw new Error('Akkaunt o‘zgargan');
      return entries.filter(entry => searchMatches(query, [entry.name, preparationReuseSubtitle(entry)])).slice(offset, offset + limit);
    } catch (error) {
      if (this.catalogRequest === request) this.catalogRequest = null;
      throw error;
    }
  }
  async reuse(sourceVariantId: string) {
    if (!this.current || !this.state.creating || this.state.copying) return null;
    this.update({ copying: true });
    try {
      const variant = await preparationReuseFormulaVariant(this.session, { ...this.options, sourceVariantId });
      if (!this.current) return null;
      this.update({ variants: [...this.state.variants.filter(item => item.id !== variant.id), variant] }); return variant;
    } finally { this.catalogRequest = null; this.update({ creating: false, copying: false }); }
  }
  async rename(variant: Variant, name: string) {
    if (!this.current || this.state.creating || this.state.opening || this.state.removing || !preparationVariantNameCanSave(name, variant.name)) return null;
    this.update({ creating: true });
    try {
      const saved = await preparationRenameFormulaVariant(this.session, { ...this.options, variantId: variant.id, name: preparationVariantName(name) });
      if (!this.current) return null;
      this.update({ variants: this.state.variants.map(item => item.id === saved.id ? saved : item) }); return saved;
    } finally { this.update({ creating: false }); }
  }
  async remove(variant: Variant) {
    if (!this.current || this.state.removing) return false;
    const generation = this.generation; this.update({ removing: true });
    try {
      await preparationRemoveFormulaVariantFromOrder(this.session, { ...this.options, variantId: variant.id });
      if (!this.current || generation !== this.generation) return false;
      this.update({ variants: this.state.variants.filter(item => item.id !== variant.id) }); return true;
    } finally { if (generation === this.generation) this.update({ removing: false }); }
  }
  invalidate() {
    if (!this.active) return;
    this.generation++; this.catalogRequest = null; this.update({ variants: [], loading: false, creating: false, opening: false,
      copying: false, removing: false, savingName: false, requestId: null, nameError: null,
      error: 'Akkaunt o‘zgargan. Sahifani qayta oching' }); this.active = false;
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
export function usePreparationVariants(session: Session, options: PreparationVariantsOptions) {
  const key = JSON.stringify(options);
  const controller = useMemo(() => new PreparationVariantsState(session, JSON.parse(key) as PreparationVariantsOptions), [session, key]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); void controller.load(); return () => controller.dispose(); }, [controller]);
  return { ...state, controller };
}

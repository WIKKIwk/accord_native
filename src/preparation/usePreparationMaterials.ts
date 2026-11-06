import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { preparationSnapshot } from '../preparationReadApi';
import { WorkerControlException } from '../workerControlsApi';
import { preparationDeleteMaterial, preparationOwnedMaterials, preparationRenameMaterial, preparationSetMaterialWarehouses } from './preparationManagementApi';
import { preparationWarehouseChoices } from './preparationLogic';

type Material = Awaited<ReturnType<typeof preparationOwnedMaterials>>[number];
type State = { items: Material[]; query: string; error: string | null; loading: boolean; refreshing: boolean; saving: boolean };
export function preparationMaterialDeleteMessage(name: string) {
  return `«${name}» o‘chirilsinmi? Faqat ishlatilmagan homashyo o‘chiriladi. Qoldiq, kirim yoki formula bo‘lsa, o‘chirish rad etiladi.`;
}
export function preparationMaterialsEmptyMessage(query: string) {
  return query.trim() ? 'Homashyo topilmadi.' : 'Hali homashyo yaratmagansiz.';
}
export function preparationMaterialsErrorMessage(error: unknown) {
  if (error instanceof WorkerControlException) return error.code === 'preparation_request_failed'
    ? 'Omborlar ro‘yxatini olib bo‘lmadi. Qayta urinib ko‘ring' : error.message;
  return 'Homashyolar bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring';
}
export class PreparationMaterialsState {
  private state: State = { items: [], query: '', error: null, loading: true, refreshing: false, saving: false };
  private active = true;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly session: Session) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<State>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  get filtered() {
    const query = this.state.query.trim().toLowerCase();
    return this.state.items.filter(item => `${item.name} ${item.item_code} ${item.warehouses.join(' ')}`.toLowerCase().includes(query));
  }
  activate() { if (!this.active) { this.active = true; this.update({ loading: true, refreshing: false, saving: false }); } }
  setQuery(query: string) { this.update({ query }); }
  async load(refresh = false) {
    if (!this.active || this.state.saving || this.state.refreshing) return;
    const generation = this.generation; this.update({ loading: !refresh, refreshing: true, error: null });
    try {
      const items = await preparationOwnedMaterials(this.session);
      if (this.active && generation === this.generation) this.update({ items });
    } catch (error) { if (this.active && generation === this.generation) this.update({ error: preparationMaterialsErrorMessage(error) }); }
    finally { if (this.active && generation === this.generation) this.update({ loading: false, refreshing: false }); }
  }
  async rename(material: Material, name: string) {
    if (!this.active || this.state.saving || this.state.loading || this.state.refreshing) return false;
    const generation = this.generation; this.update({ saving: true });
    try {
      const saved = await preparationRenameMaterial(this.session, material.item_code, name);
      if (!this.active || generation !== this.generation) return false;
      this.update({ items: this.state.items.map(item => item.item_code === material.item_code ? { ...item, name: saved } : item)
        .sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0) });
      return true;
    } finally { if (generation === this.generation) this.update({ saving: false }); }
  }
  async remove(material: Material) {
    if (!this.active || this.state.saving || this.state.loading || this.state.refreshing) return false;
    const generation = this.generation; this.update({ saving: true });
    try { await preparationDeleteMaterial(this.session, material.item_code);
      if (!this.active || generation !== this.generation) return false;
      this.update({ items: this.state.items.filter(item => item.item_code !== material.item_code) }); return true; }
    finally { if (generation === this.generation) this.update({ saving: false }); }
  }
  async warehouseChoices(material: Material) {
    if (!this.active || this.state.saving || this.state.loading || this.state.refreshing) return null;
    const generation = this.generation; this.update({ saving: true });
    try { const snapshot = await preparationSnapshot(this.session);
      return this.active && generation === this.generation ? preparationWarehouseChoices(snapshot.material_warehouses, material.warehouses) : null; }
    finally { if (generation === this.generation) this.update({ saving: false }); }
  }
  async setWarehouses(material: Material, warehouses: string[]) {
    if (!this.active || this.state.saving || this.state.loading || this.state.refreshing) return false;
    const generation = this.generation; this.update({ saving: true });
    try { const updated = await preparationSetMaterialWarehouses(this.session, material.item_code, warehouses);
      if (!this.active || generation !== this.generation) return false;
      this.update({ items: this.state.items.map(item => item.item_code === updated.item_code ? updated : item) }); return true; }
    finally { if (generation === this.generation) this.update({ saving: false }); }
  }
  invalidate() {
    if (!this.active) return;
    this.generation++; this.update({ items: [], query: '', loading: false, refreshing: false, saving: false,
      error: 'Akkaunt o‘zgargan. Sahifani qayta oching' }); this.active = false;
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
export function usePreparationMaterials(session: Session) {
  const controller = useMemo(() => new PreparationMaterialsState(session), [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); void controller.load(); return () => controller.dispose(); }, [controller]);
  return { ...state, filtered: controller.filtered, controller };
}

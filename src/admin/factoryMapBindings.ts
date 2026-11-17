import type { AdminApparatus } from '../apparatusApi';
import { canonicalFactoryMapObjectId as canonical } from './factoryMapMapping';
export class FactoryMapBindingFailure extends Error { constructor(readonly reason: string) { super(reason); } }
/** @v2 FactoryMapBindings: read back uncertain writes; retry only one unrelated revision conflict. */
export class FactoryMapBindings {
  apparatus: readonly AdminApparatus[] = []; loading = false; saving = false; ready = false; error: unknown = null;
  private generation = 0; private disposed = false;
  constructor(private readonly load: () => Promise<AdminApparatus[]>, private readonly read: (id: string) => Promise<AdminApparatus>, private readonly write: (apparatus: AdminApparatus, objectId: string) => Promise<AdminApparatus>, private readonly current: () => boolean) {}
  private check() { if (this.disposed || !this.current()) throw new FactoryMapBindingFailure('busy'); }
  async refresh() { if (this.saving || this.disposed) return; const generation = ++this.generation; this.loading = true; this.error = null; try { const rows = await this.load(); this.check(); if (generation === this.generation) { this.apparatus = rows; this.ready = true; } } catch (error) { if (!this.disposed && generation === this.generation) { this.error = error; this.ready = false; } } finally { if (generation === this.generation) this.loading = false; } }
  private replace(saved: AdminApparatus) { this.apparatus = [...this.apparatus.filter(item => item.id !== saved.id), saved]; }
  private async fresh(id: string) { try { const rows = await this.load(), current = await this.read(id); this.check(); if (current.id !== id) throw new FactoryMapBindingFailure('save_failed'); this.apparatus = rows; this.replace(current); this.ready = true; this.error = null; return current; } catch (error) { this.ready = false; this.error = error; throw error; } }
  async save(observed: AdminApparatus, objectId: string) {
    this.check(); if (this.saving) throw new FactoryMapBindingFailure('busy'); this.saving = true; this.loading = false; ++this.generation;
    const target = canonical(objectId), previous = canonical(observed.factory_map_object_id);
    try { let current = await this.fresh(observed.id);
      for (let attempt = 0; attempt < 2; attempt++) {
        this.check(); const placement = canonical(current.factory_map_object_id);
        if (target && current.lifecycle_state !== 'active') throw new FactoryMapBindingFailure('retired');
        if (placement === target) return current;
        if (placement !== previous) throw new FactoryMapBindingFailure('changed');
        if (target && this.apparatus.some(item => item.id !== current.id && canonical(item.factory_map_object_id) === target)) throw new FactoryMapBindingFailure('duplicate');
        try { const saved = await this.write(current, target); this.check(); if (saved.id !== current.id || canonical(saved.factory_map_object_id) !== target) throw new FactoryMapBindingFailure('not_applied'); this.replace(saved); return saved; }
        catch (error) { try { current = await this.fresh(observed.id); } catch { throw new FactoryMapBindingFailure('uncertain'); }
          if (canonical(current.factory_map_object_id) === target) return current;
          if ((error as { code?: string })?.code === 'apparatus_revision_conflict' && attempt === 0) continue;
          if (target && this.apparatus.some(item => item.id !== current.id && canonical(item.factory_map_object_id) === target)) throw new FactoryMapBindingFailure('duplicate'); throw error;
        }
      } throw new FactoryMapBindingFailure('changed');
    } finally { this.saving = false; }
  }
  dispose() { this.disposed = true; this.generation++; }
}

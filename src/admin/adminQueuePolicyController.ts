import type { AdminApparatus } from '../apparatusApi';
import { adminQueuePolicyEffective, type AdminApparatusQueuePolicy, type AdminQueuePolicyData, type ApparatusQueuePolicy } from './adminQueuePolicyModel';
import { dartTrim } from './dartJsonString';

export type AdminQueuePolicyState = { data: AdminQueuePolicyData | null; loading: boolean; loadError: unknown | null;
  policies: AdminQueuePolicyData['policies']; saving: ReadonlySet<string>; invalidated: boolean; errorNotice: { serial: number; error: unknown } | null };
export type AdminQueuePolicyDependencies = {
  isCurrent: () => boolean; cached: () => AdminQueuePolicyData | null; cache: (data: AdminQueuePolicyData) => void;
  read: (guard: () => void, witness: () => boolean) => Promise<AdminQueuePolicyData>;
  write: (input: { apparatusId: string; expectedRevision: number; policy: ApparatusQueuePolicy }, guard: () => void) => Promise<AdminApparatusQueuePolicy>;
};

/** @v2 _AdminQueuePolicyPanelState */
export class AdminQueuePolicyController {
  private state: AdminQueuePolicyState = { data: null, loading: true, loadError: null, policies: {}, saving: new Set(), invalidated: false, errorNotice: null };
  private readonly listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private noticeSerial = 0;
  constructor(private readonly deps: AdminQueuePolicyDependencies) {
    const data = deps.isCurrent() ? deps.cached() : null;
    if (data) this.state = { ...this.state, data, policies: data.policies, loading: false };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminQueuePolicyState>): void {
    if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (): boolean => {
    if (!this.active || this.state.invalidated) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; } return true;
  };
  private guard(generation: number): void { if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin queue policy session changed'); }
  start(): void {
    if (this.active || this.state.invalidated) return;
    this.active = true;
    if (!this.isCurrent()) return;
    const data = this.deps.cached();
    this.publish({ data, policies: data?.policies ?? {}, loading: !data, loadError: null, saving: new Set(), errorNotice: null });
    void this.reload(!data);
  }
  async reload(showLoading = true): Promise<void> {
    if (!this.isCurrent()) return;
    const generation = this.generation, guard = () => this.guard(generation);
    if (showLoading) this.publish({ loading: true, loadError: null });
    try {
      guard(); const data = await this.deps.read(guard, () => { guard(); return true; }); guard();
      this.deps.cache(data); guard(); this.publish({ data, policies: data.policies, loading: false, loadError: null });
    } catch (loadError) {
      if (generation === this.generation && this.isCurrent()) this.publish(this.state.data ? { loading: false } : { loading: false, loadError });
    }
  }
  async update(apparatus: AdminApparatus, policy: ApparatusQueuePolicy): Promise<void> {
    if (!this.isCurrent() || !this.state.data?.apparatus.includes(apparatus)) return;
    const id = dartTrim(apparatus.id), current = adminQueuePolicyEffective(apparatus, this.state.policies);
    if (!id || this.state.saving.has(id) || current.locked) return;
    const generation = this.generation, guard = () => this.guard(generation);
    this.publish({ saving: new Set([...this.state.saving, id]) });
    try {
      guard(); const saved = await this.deps.write({ apparatusId: id,
        expectedRevision: current.source_revision > 0 ? current.source_revision : apparatus.source_revision, policy }, guard); guard();
      const policies = { ...this.state.policies, [saved.apparatus_id]: saved }, data = this.state.data && { ...this.state.data, policies };
      if (data) { this.deps.cache(data); guard(); }
      this.publish({ policies, data });
    } catch (error) {
      if (generation === this.generation && this.isCurrent()) this.publish({ errorNotice: { serial: ++this.noticeSerial, error } });
    } finally {
      if (generation === this.generation && this.isCurrent()) { const saving = new Set(this.state.saving); saving.delete(id); this.publish({ saving }); }
    }
  }
  dismissError(serial: number): void { if (this.isCurrent() && this.state.errorNotice?.serial === serial) this.publish({ errorNotice: null }); }
  invalidate(): void {
    if (this.state.invalidated) return;
    this.generation++; this.publish({ data: null, policies: {}, saving: new Set(), loading: false, loadError: null, invalidated: true, errorNotice: null });
  }
  dispose(): void { this.active = false; this.generation++; this.listeners.clear(); }
}

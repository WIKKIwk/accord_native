import type { AdminApparatus } from '../apparatusApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartTrim } from './dartJsonString';
import { factoryLocationEditorPlan, orderedFactoryApparatus, replaceFactoryLocation, upsertFactoryLocation } from './factoryLocationEditorModel';
import type { AdminFactoryLocation } from './factoryLocationModel';

type Generation = string | number;
type Guard = () => void;
export type FactoryNotice = { source: 'server'; message: string; serial: number } | { source: 'localization'; key: string; serial: number };
export type FactoryLocationSnapshot = { status: 'loading' | 'error' | 'ready' | 'forbidden'; saving: boolean;
  locations: AdminFactoryLocation[]; apparatus: AdminApparatus[]; notice: FactoryNotice | null };
export type FactoryLocationDependencies = {
  isCurrent: () => boolean; scope: () => string; generation: () => Generation | null; canManage: () => boolean;
  readLocations: (guard: Guard) => Promise<AdminFactoryLocation[]>;
  readApparatus: (guard: Guard) => Promise<AdminApparatus[]>;
  create: (name: string, ids: readonly string[], guard: Guard) => Promise<AdminFactoryLocation>;
  replaceApparatus: (id: string, ids: readonly string[], guard: Guard) => Promise<AdminFactoryLocation>;
  update: (id: string, change: { name?: string; active?: boolean }, guard: Guard) => Promise<AdminFactoryLocation>;
};
export type FactoryLocationTicket = { readonly owner: symbol; readonly epoch: number; readonly location: AdminFactoryLocation | null };
export type FactorySaveResult = 'saved' | 'nameRequired' | 'cancelled' | 'failed';
const empty = (): FactoryLocationSnapshot => ({ status: 'loading', saving: false, locations: [], apparatus: [], notice: null });

/** Partial state derived from V2 _AdminFactoryLocationsScreenState; integration remains open. */
export class FactoryLocationController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private readonly owner = Symbol('factory-locations');
  private readonly scope: string;
  private readonly generation: Generation | null;
  private active = false;
  private epoch = 0;
  private loadSerial = 0;
  private mutationVersion = 0;
  private noticeSerial = 0;
  constructor(private readonly deps: FactoryLocationDependencies) { this.scope = deps.scope(); this.generation = deps.generation(); }
  getSnapshot = (): FactoryLocationSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private emit(change: Partial<FactoryLocationSnapshot>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  private valid(epoch = this.epoch): boolean {
    return this.active && epoch === this.epoch && this.generation !== null && this.deps.generation() === this.generation &&
      this.deps.isCurrent() && this.deps.scope() === this.scope && this.deps.canManage();
  }
  private guard(epoch: number): Guard { return () => { if (!this.valid(epoch)) throw new Error('Factory session changed'); }; }
  private currentOrInvalidate(epoch: number): boolean {
    if (this.valid(epoch)) return true;
    if (this.active && epoch === this.epoch) this.invalidate();
    return false;
  }
  start(): void {
    if (this.active) return;
    this.active = true; this.epoch++; this.state = empty();
    if (!this.currentOrInvalidate(this.epoch)) return;
    void this.load();
  }
  invalidate(): void {
    this.epoch++; this.loadSerial++;
    this.emit({ status: 'forbidden', saving: false, locations: [], apparatus: [], notice: null });
  }
  dispose(): void { this.active = false; this.epoch++; this.loadSerial++; this.listeners.clear(); }
  dismissNotice(serial: number): void {
    if (this.currentOrInvalidate(this.epoch) && this.state.notice?.serial === serial) this.emit({ notice: null });
  }
  async load(): Promise<void> {
    const epoch = this.epoch;
    if (!this.currentOrInvalidate(epoch)) return;
    const serial = ++this.loadSerial, mutation = this.mutationVersion, guard = this.guard(epoch);
    this.emit({ status: 'loading' });
    if (!this.currentOrInvalidate(epoch)) return;
    try {
      const [locations, apparatus] = await Promise.all([this.deps.readLocations(guard), this.deps.readApparatus(guard)]);
      if (!this.currentOrInvalidate(epoch) || serial !== this.loadSerial) return;
      if (mutation !== this.mutationVersion) { void this.load(); return; }
      this.emit({ status: 'ready', locations, apparatus: orderedFactoryApparatus(apparatus) });
      this.currentOrInvalidate(epoch);
    } catch {
      if (!this.currentOrInvalidate(epoch) || serial !== this.loadSerial) return;
      if (mutation !== this.mutationVersion) { void this.load(); return; }
      this.emit({ status: 'error' });
      this.currentOrInvalidate(epoch);
    }
  }
  beginEditor(id: string | null): FactoryLocationTicket | null {
    if (!this.currentOrInvalidate(this.epoch) || this.state.saving || this.state.status !== 'ready') return null;
    const location = id === null ? null : this.state.locations.find(item => item.id === id);
    if (id !== null && !location) return null;
    return { owner: this.owner, epoch: this.epoch, location: location ?? null };
  }
  private ticketValid(ticket: FactoryLocationTicket): boolean {
    return ticket.owner === this.owner && this.currentOrInvalidate(ticket.epoch) && !this.state.saving && this.state.status === 'ready';
  }
  async saveEditor(ticket: FactoryLocationTicket, name: string, selected: ReadonlySet<string>): Promise<FactorySaveResult> {
    if (!this.ticketValid(ticket)) return 'cancelled';
    const plan = factoryLocationEditorPlan(ticket.location, name, selected);
    if (plan.kind === 'nameRequired') return 'nameRequired';
    return this.save(ticket.epoch, 'factory.state_save_failed', async guard => {
      if (plan.kind === 'create') return this.deps.create(plan.name, plan.apparatusIds, guard);
      if (plan.kind === 'replace') return this.deps.replaceApparatus(plan.id, plan.apparatusIds, guard);
      return plan.location;
    }, saved => upsertFactoryLocation(this.state.locations, saved));
  }
  async rename(ticket: FactoryLocationTicket, value: string): Promise<FactorySaveResult> {
    if (!this.ticketValid(ticket) || !ticket.location) return 'cancelled';
    const name = dartTrim(value);
    if (!name) return 'nameRequired';
    if (name === ticket.location.name) return 'cancelled';
    return this.save(ticket.epoch, 'factory.state_update_failed', guard => this.deps.update(ticket.location!.id, { name }, guard),
      saved => replaceFactoryLocation(this.state.locations, saved, true));
  }
  async setActive(id: string, active: boolean): Promise<FactorySaveResult> {
    const ticket = this.beginEditor(id);
    if (!ticket?.location) return 'cancelled';
    return this.save(ticket.epoch, 'factory.state_status_failed', guard => this.deps.update(id, { active }, guard),
      saved => replaceFactoryLocation(this.state.locations, saved, false));
  }
  private async save(epoch: number, fallback: string, write: (guard: Guard) => Promise<AdminFactoryLocation>,
    merge: (saved: AdminFactoryLocation) => AdminFactoryLocation[]): Promise<FactorySaveResult> {
    if (!this.currentOrInvalidate(epoch) || this.state.saving) return 'cancelled';
    this.mutationVersion++;
    this.emit({ saving: true });
    if (!this.currentOrInvalidate(epoch)) return 'cancelled';
    try {
      const saved = await write(this.guard(epoch));
      if (!this.currentOrInvalidate(epoch)) return 'cancelled';
      this.mutationVersion++;
      this.emit({ saving: false, locations: merge(saved) });
      return this.currentOrInvalidate(epoch) ? 'saved' : 'cancelled';
    } catch (error) {
      if (!this.currentOrInvalidate(epoch)) return 'cancelled';
      this.mutationVersion++;
      const serial = ++this.noticeSerial;
      this.emit({ saving: false, notice: error instanceof MobileApiException
        ? { source: 'server', message: error.message, serial } : { source: 'localization', key: fallback, serial } });
      return this.currentOrInvalidate(epoch) ? 'failed' : 'cancelled';
    }
  }
}

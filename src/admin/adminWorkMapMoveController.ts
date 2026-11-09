import type { AdminApparatus } from '../apparatusApi';
import { adminWorkMapCurrent } from './adminWorkMapCurrent';
import { AdminWorkMapController, type AdminWorkMapPage, type AdminWorkMapRequest, type AdminWorkMapState } from './adminWorkMapController';
import { adminWorkMapMoveDefaults, adminWorkMapMovePickerOptions, adminWorkMapMoveSame, adminWorkMapMoveScope,
  type AdminWorkMapMoveSelection } from './adminWorkMapMoveModel';

export type AdminWorkMapMoveState = { top: AdminWorkMapMoveSelection | null; bottom: AdminWorkMapMoveSelection | null;
  topWindow: AdminWorkMapState; bottomWindow: AdminWorkMapState };
type Dependencies = { isCurrent: () => boolean; read: (request: AdminWorkMapRequest & { search: string; cursor?: string | null }, witness: () => boolean) => Promise<AdminWorkMapPage | null> };
type Side = 'top' | 'bottom';
export type AdminWorkMapMovePicker = { generation: number; side: Side; selected: AdminWorkMapMoveSelection; options: readonly AdminWorkMapMoveSelection[] };
/** Read-only opposite windows. No order selection, drag, command, transfer or acknowledgement API exists here. */
export class AdminWorkMapMoveController {
  readonly topWindow: AdminWorkMapController;
  readonly bottomWindow: AdminWorkMapController;
  private state: AdminWorkMapMoveState;
  private catalog: readonly AdminApparatus[] = [];
  private pickerGeneration = 0;
  private listeners = new Set<() => void>();
  private active = false;
  private disposed = false;
  private invalidating = false;
  private batching = false;
  private stop: (() => void)[];
  constructor(private readonly deps: Dependencies) {
    this.topWindow = new AdminWorkMapController({ ...deps, request: null });
    this.bottomWindow = new AdminWorkMapController({ ...deps, request: null });
    this.state = { top: null, bottom: null, topWindow: this.topWindow.getSnapshot(), bottomWindow: this.bottomWindow.getSnapshot() };
    this.stop = [this.topWindow.subscribe(() => this.publish({ topWindow: this.topWindow.getSnapshot() })),
      this.bottomWindow.subscribe(() => this.publish({ bottomWindow: this.bottomWindow.getSnapshot() }))];
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current() { return !this.disposed && !this.invalidating && adminWorkMapCurrent(this.deps.isCurrent) && !this.disposed && !this.invalidating; }
  private publish(patch: Partial<AdminWorkMapMoveState>) {
    this.state = { ...this.state, ...patch }; if (!this.batching) this.listeners.forEach(listener => listener());
  }
  start() { if (this.current()) { this.topWindow.start(); this.bottomWindow.start(); } }
  setCatalog(catalog: readonly AdminApparatus[]) {
    if (!this.current()) return;
    this.catalog = catalog; this.pickerGeneration++;
    this.state = { ...this.state, ...adminWorkMapMoveDefaults(catalog, this.state.top, this.state.bottom) }; this.configure();
  }
  setActive(active: boolean) { if (this.current() && this.active !== active) { this.active = active; this.pickerGeneration++; this.configure(); } }
  picker(side: Side): AdminWorkMapMovePicker | null {
    const selected = this.state[side], opposite = this.state[side === 'top' ? 'bottom' : 'top'];
    if (!this.current() || !this.active || !selected || !opposite) return null;
    return { generation: this.pickerGeneration, side, selected, options: adminWorkMapMovePickerOptions(this.catalog, opposite) };
  }
  choose(picker: AdminWorkMapMovePicker, selection: AdminWorkMapMoveSelection): boolean {
    if (!this.current() || !this.active || picker.generation !== this.pickerGeneration) return false;
    const opposite = this.state[picker.side === 'top' ? 'bottom' : 'top'];
    if (!opposite) return false;
    const selected = adminWorkMapMovePickerOptions(this.catalog, opposite).find(item => adminWorkMapMoveSame(item, selection));
    if (!selected) return false;
    const same = adminWorkMapMoveSame(this.state[picker.side], selected);
    this.pickerGeneration++; this.state = { ...this.state, [picker.side]: selected }; this.configure();
    if (same) void this.reload();
    return true;
  }
  private configure() {
    this.batching = true;
    try {
      const { top, bottom } = this.state, ready = this.active && top != null && bottom != null;
      this.topWindow.configure(ready ? { view: 'move', apparatus: adminWorkMapMoveScope(top), target: adminWorkMapMoveScope(bottom) } : null);
      this.bottomWindow.configure(ready ? { view: 'move', apparatus: adminWorkMapMoveScope(bottom), target: adminWorkMapMoveScope(top) } : null);
    } finally { this.batching = false; this.publish({}); }
  }
  setQuery(value: string) { if (this.current()) { this.topWindow.setQuery(value); this.bottomWindow.setQuery(value); } }
  async reload() { if (this.current() && this.active) await Promise.all([this.topWindow.reload(), this.bottomWindow.reload()]); }
  invalidate() {
    if (this.disposed || this.invalidating) return;
    this.invalidating = true; this.pickerGeneration++; this.catalog = []; this.batching = true;
    try { this.topWindow.invalidate(); this.bottomWindow.invalidate(); this.state = { ...this.state, top: null, bottom: null }; }
    finally { this.batching = false; try { this.publish({}); } finally { this.invalidating = false; } }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.pickerGeneration++; this.catalog = []; this.batching = true;
    try { this.topWindow.dispose(); this.bottomWindow.dispose(); this.state = { ...this.state, top: null, bottom: null }; }
    finally { this.batching = false; try { this.publish({}); } finally { this.stop.forEach(stop => stop()); this.listeners.clear(); } }
  }
}

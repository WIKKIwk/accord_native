import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export type AdminMenuAction = Readonly<{ id: string; label: string; icon: { ios: SFSymbol; android: AndroidSymbol };
  enabled?: boolean; onPress: () => void | Promise<void> }>;
export type AdminCreateMenuSnapshot = Readonly<{ open: boolean; actions: readonly AdminMenuAction[] }>;

/** V2 create overlay: close first, then invoke the selected action after a frame. */
export class AdminCreateMenuController {
  private snapshot: AdminCreateMenuSnapshot;
  private source: readonly AdminMenuAction[];
  private active = true;
  private retired = false;
  private visible = true;
  private generation = 0;
  private selectionSerial = 0;
  private pendingSelection: number | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(actions: readonly AdminMenuAction[], private readonly isCurrent: () => boolean,
    private readonly afterFrame: () => Promise<void>) {
    this.source = actions;
    this.snapshot = { open: false, actions: this.copy(actions) };
  }
  private copy(actions: readonly AdminMenuAction[]) { return Object.freeze(actions.map(action => Object.freeze({ ...action }))); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminCreateMenuSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private current() {
    if (!this.active || this.retired) return false;
    if (!isSynchronouslyTrue(this.isCurrent)) { this.retired = true; this.generation++; return false; }
    return true;
  }
  activate() { if (!this.retired) this.active = true; }
  configure(actions: readonly AdminMenuAction[]) {
    if (actions === this.source) return;
    this.source = actions; this.generation++; this.pendingSelection = null;
    this.publish({ open: false, actions: this.copy(actions) });
  }
  recheck() { if (!this.current()) this.close(); }
  toggle() {
    if (!this.visible || !this.current() || !this.snapshot.actions.length) return;
    this.publish({ open: !this.snapshot.open });
  }
  close() { if (this.snapshot.open) this.publish({ open: false }); }
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible; this.generation++; this.pendingSelection = null;
    if (!visible) this.close();
  }
  async select(id: string): Promise<void> {
    if (!this.visible || !this.current() || this.pendingSelection !== null) return;
    const action = this.snapshot.actions.find(item => item.id === id);
    if (!action || action.enabled === false) return;
    const generation = this.generation, serial = ++this.selectionSerial;
    this.pendingSelection = serial;
    try {
      this.close();
      await this.afterFrame();
      if (generation !== this.generation || !this.visible || !this.current()) return;
      await action.onPress();
    } finally {
      if (this.pendingSelection === serial) this.pendingSelection = null;
    }
  }
  detach() { this.active = false; this.generation++; this.pendingSelection = null; this.close(); }
}

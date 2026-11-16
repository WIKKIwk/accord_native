import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminMenuAction } from './adminCreateMenuController';
import type { AdminCreateHubDefaultAction } from './adminCreateHubModel';

export type AdminCreateHubReadiness = Readonly<{ ready: boolean; missingRoutes: readonly string[]; hasPrimary: boolean }>;
export type AdminCreateHubRequest = Readonly<{ isCurrent: () => boolean; canInteract: () => boolean; isFocused: () => boolean;
  showPrimaryFab?: boolean; actions?: readonly AdminMenuAction[]; hasReplacement?: boolean; replacement?: unknown }>;
export type AdminCreateHubTicket = Readonly<{ id: number; generation: number }>;
export type AdminCreateHubAction = Readonly<{ id: string; label: string; enabled: boolean; order: number;
  materialIcon?: string; icon?: AdminMenuAction['icon']; routeName?: string; onPress?: AdminMenuAction['onPress'] }>;
export type AdminCreateHubOverlay = Readonly<{ id: number; generation: number; motion: number; targetOpen: boolean;
  mode: 'default' | 'custom'; actions: readonly AdminCreateHubAction[] }>;
export type AdminCreateHubSnapshot = Readonly<{ valid: boolean; version: number; overlay: AdminCreateHubOverlay | null; profileOnStack: boolean }>;
type Trigger = { ticket: AdminCreateHubTicket; request: AdminCreateHubRequest; checking: boolean; retired: boolean };
type Job = { generation: number; cancel: (() => void) | null; done: boolean };

/** @v2 showAdminCreateHubSheet
 * One owner above the real native stack retains the first opening's arguments.
 * Dispatch acknowledgement is independent of the closing animation's lifetime.
 */
export class AdminCreateHubController {
  private state: AdminCreateHubSnapshot = { valid: false, version: 0, overlay: null, profileOnStack: false };
  private active = false; private retired = false; private checking = false; private generation = 0; private sequence = 0; private overlaySequence = 0;
  private settling = false; private selecting = false; private issuing = false; private planning = false;
  private readonly triggers = new Map<number, Trigger>(); private readonly jobs = new Set<Job>(); private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: { isCurrent: () => boolean; readiness: () => AdminCreateHubReadiness;
    actions: () => readonly AdminCreateHubDefaultAction[]; routeAvailable: (route: string) => boolean; openRoute: (route: string) => void | Promise<void>;
    nextFrame: (callback: () => void) => () => void }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminCreateHubSnapshot>) { this.state = { ...this.state, ...patch, version: this.state.version + 1 }; for (const listener of [...this.listeners]) listener(); }
  start() { if (this.active || this.retired) return; this.active = true; this.generation++; this.publish({ valid: true }); this.recheck(); }
  isCurrent(generation = this.generation): boolean {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.retired = true; return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid) this.retired = true; return valid && !this.retired && this.active && generation === this.generation;
  }
  recheck() { if (!this.isCurrent()) this.invalidate(); }
  setProfileOnStack(value: boolean) { if (this.active && this.state.profileOnStack !== value) this.publish({ profileOnStack: value }); }
  register(request: AdminCreateHubRequest): AdminCreateHubTicket | null {
    if (!this.isCurrent()) return null; const ticket = Object.freeze({ id: ++this.sequence, generation: this.generation });
    this.triggers.set(ticket.id, { ticket, request, checking: false, retired: false }); this.publish({}); return ticket;
  }
  unregister(ticket: AdminCreateHubTicket) { const trigger = this.triggers.get(ticket.id); if (trigger?.ticket !== ticket) return; this.triggers.delete(ticket.id); trigger.retired = true; this.publish({}); }
  private triggerCurrent(trigger: Trigger, interaction: boolean): boolean {
    if (trigger.retired || this.triggers.get(trigger.ticket.id) !== trigger || !this.isCurrent(trigger.ticket.generation)) return false;
    if (trigger.checking) { trigger.retired = true; return false; } trigger.checking = true;
    const current = isSynchronouslyTrue(trigger.request.isCurrent), focused = current && isSynchronouslyTrue(trigger.request.isFocused);
    const interactive = !interaction || focused && isSynchronouslyTrue(trigger.request.canInteract); trigger.checking = false;
    if (!current) trigger.retired = true;
    return current && focused && interactive && !trigger.retired && this.isCurrent(trigger.ticket.generation);
  }
  readiness(): AdminCreateHubReadiness {
    if (this.planning) { this.retired = true; return { ready: false, missingRoutes: [], hasPrimary: false }; }
    this.planning = true; try { return this.deps.readiness(); } catch { this.retired = true; return { ready: false, missingRoutes: [], hasPrimary: false }; } finally { this.planning = false; }
  }
  refreshLocale() {
    if (!this.isCurrent()) return; const overlay = this.state.overlay;
    if (overlay?.mode === 'default') {
      const actions = Object.freeze(this.deps.actions().map(action => Object.freeze({ id: action.id, label: action.label, enabled: true,
        order: action.staggerOrder, materialIcon: action.materialIcon, routeName: action.routeName })));
      if (this.state.overlay === overlay && this.overlayCurrent(overlay.id, overlay.generation)) this.publish({ overlay: Object.freeze({ ...overlay, actions }) });
    } else this.publish({});
  }

  primary() {
    if (!this.isCurrent()) return null;
    for (const trigger of [...this.triggers.values()].reverse()) {
      if (!this.triggerCurrent(trigger, false)) continue;
      const plan = this.readiness(), hasPrimary = !!trigger.request.hasReplacement || plan.hasPrimary;
      const visible = hasPrimary && trigger.request.showPrimaryFab !== false && !this.state.profileOnStack && this.state.overlay === null;
      const ready = trigger.request.actions !== undefined || trigger.request.hasReplacement ? true : plan.ready;
      if (!this.triggerCurrent(trigger, false)) return null;
      return { ticket: trigger.ticket, hasPrimary, visible, ready, replacement: !!trigger.request.hasReplacement, replacementValue: trigger.request.replacement };
    }
    return null;
  }
  open(ticket: AdminCreateHubTicket): boolean {
    if (this.settling || this.selecting || this.issuing) return false;
    this.issuing = true; try { return this.openNow(ticket); } finally { this.issuing = false; }
  }
  private openNow(ticket: AdminCreateHubTicket): boolean { const trigger = this.triggers.get(ticket.id);
    if (!trigger || trigger.ticket !== ticket || !this.triggerCurrent(trigger, true)) return false;
    const plan = this.readiness();
    if ((!plan.hasPrimary && !trigger.request.hasReplacement) || trigger.request.showPrimaryFab === false || this.state.profileOnStack ||
      trigger.request.hasReplacement || trigger.request.actions === undefined && !plan.ready || !this.triggerCurrent(trigger, true)) return false;
    if (this.state.overlay) { this.setOpen(this.state.overlay.id, true); return true; }
    const custom = trigger.request.actions, defaults = custom === undefined ? this.deps.actions() : [];
    const actions: readonly AdminCreateHubAction[] = Object.freeze(custom !== undefined ? custom.map((action, index) => Object.freeze({ id: action.id, label: action.label, icon: Object.freeze({ ...action.icon }),
      enabled: action.enabled !== false, order: custom.length - 1 - index, onPress: action.onPress })) : defaults.map(action => Object.freeze({ id: action.id, label: action.label,
      enabled: true, order: action.staggerOrder, materialIcon: action.materialIcon, routeName: action.routeName })));
    if (!this.triggerCurrent(trigger, true)) return false;
    this.publish({ overlay: Object.freeze({ id: ++this.overlaySequence, generation: this.generation, motion: 1, targetOpen: true, mode: custom === undefined ? 'default' : 'custom', actions }) });
    return this.isCurrent(ticket.generation);
  }
  overlayCurrent(id: number, generation: number) { return this.isCurrent(generation) && this.state.overlay?.id === id && this.state.overlay.generation === generation; }
  setOpen(id: number, open: boolean) {
    const overlay = this.state.overlay; if (this.settling || !overlay || !this.overlayCurrent(id, overlay.generation) || overlay.targetOpen === open) return;
    this.publish({ overlay: Object.freeze({ ...overlay, motion: overlay.motion + 1, targetOpen: open }) });
  }
  toggle(id: number, generation: number) { if (!this.overlayCurrent(id, generation)) return; this.setOpen(id, !this.state.overlay!.targetOpen); }
  close(id: number, generation: number) { if (this.overlayCurrent(id, generation)) this.setOpen(id, false); }
  closed(id: number, generation: number, motion: number) {
    const overlay = this.state.overlay; if (!overlay || overlay.motion !== motion || overlay.targetOpen || !this.overlayCurrent(id, generation)) return;
    this.removeOverlay();
  }
  private removeOverlay() { this.settling = true; try { this.publish({ overlay: null }); } finally { this.settling = false; } }
  select(id: number, generation: number, actionId: string): boolean {
    if (this.selecting || this.settling) return false; this.selecting = true;
    try {
      if (!this.overlayCurrent(id, generation)) return false;
      const overlay = this.state.overlay!, action = overlay.actions.find(action => action.id === actionId);
      if (!action?.enabled || !action.routeName && typeof action.onPress !== 'function' || action.routeName && !isSynchronouslyTrue(() => this.deps.routeAvailable(action.routeName!)) || !this.overlayCurrent(id, generation)) return false;
      if (overlay.mode === 'custom') this.removeOverlay(); else this.close(id, generation);
      if (!this.isCurrent(generation)) return false;
      const job: Job = { generation, cancel: null, done: false }; this.jobs.add(job);
      try {
        job.cancel = this.deps.nextFrame(() => {
          if (job.done) return; job.done = true; this.jobs.delete(job);
          if (!this.isCurrent(generation) || action.routeName && !isSynchronouslyTrue(() => this.deps.routeAvailable(action.routeName!)) || !this.isCurrent(generation)) return;
          try { void Promise.resolve(action.routeName ? this.deps.openRoute(action.routeName) : action.onPress?.()).catch(() => {}); } catch { /* Source adds no new error surface. */ }
        });
        if (job.done) job.cancel = null;
      } catch { job.done = true; this.jobs.delete(job); return false; }
      return true;
    } finally { this.selecting = false; }
  }
  invalidate() { this.retired = true; this.dispose(); }
  dispose() {
    this.active = false; this.generation++; for (const trigger of this.triggers.values()) trigger.retired = true; this.triggers.clear();
    for (const job of this.jobs) { job.done = true; try { job.cancel?.(); } catch {} } this.jobs.clear(); this.publish({ valid: false, overlay: null });
  }
}

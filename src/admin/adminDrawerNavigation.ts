import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminDrawerNavigationPlan, type AdminDrawerDestination } from './adminDrawerModel';
import { adminDrawerActiveStack, type AdminDrawerNavigationState } from './adminDrawerNavigationState';

export type AdminDrawerNavigationDependencies = {
  platform: string; workspace?: 'admin' | 'brigader'; home: string; isCurrent: () => boolean;
  destination: (route: string) => string | null;
  rootState: () => AdminDrawerNavigationState | undefined;
  push: (path: string) => void; replace: (path: string) => void; popTo: (path: string) => void;
  confirmLogout: (confirmed: () => void) => void; logout: () => void;
};

/** @v2 RoleNavigationDrawer delay + AdminDrawerNavigation.openRoute. */
export class AdminDrawerNavigation {
  private active = false; private retired = false; private epoch = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(private readonly deps: AdminDrawerNavigationDependencies) {}
  attach() { if (!this.active) { this.active = true; this.epoch++; } }
  detach() { this.active = false; this.epoch++; for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); }
  private current(epoch = this.epoch): boolean {
    if (!this.active || this.retired || epoch !== this.epoch) return false;
    if (!isSynchronouslyTrue(this.deps.isCurrent)) { this.retired = true; return false; }
    return this.active && !this.retired && epoch === this.epoch;
  }
  private stack() {
    try { return adminDrawerActiveStack(this.deps.rootState(), this.deps.platform, this.deps.workspace); } catch { return null; }
  }
  private after(delay: number, callback: () => void) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delay); this.timers.add(timer);
  }
  select(destination: AdminDrawerDestination) {
    if (!this.current()) return;
    const selected = { ...destination };
    const epoch = this.epoch, target = this.deps.destination(selected.routeName), origin = this.stack();
    if (!target || !origin || origin.currentPath === target || !this.current(epoch)) return;
    this.after(220, () => {
      if (!this.current(epoch) || this.deps.destination(selected.routeName) !== target || !this.current(epoch)) return;
      const stack = this.stack(), home = this.deps.destination(this.deps.home);
      if (!stack || stack.key !== origin.key || !this.current(epoch) || stack.currentPath === target) return;
      const plan = adminDrawerNavigationPlan(stack.currentPath, { ...selected, routeName: target }, home ?? '', stack.paths);
      if (this.deps.destination(selected.routeName) !== target || !this.current(epoch)) return;
      if (plan === 'push') this.deps.push(target);
      else if (plan === 'replace') this.deps.replace(target);
      else if (plan === 'popTo') this.deps.popTo(target);
    });
  }
  logout() {
    if (!this.current()) return;
    const epoch = this.epoch, origin = this.stack(); if (!origin || !this.current(epoch)) return;
    const valid = () => this.current(epoch) && this.stack()?.key === origin.key && this.current(epoch);
    this.after(120, () => {
      if (!valid()) return;
      let answered = false;
      this.deps.confirmLogout(() => { if (answered) return; answered = true; if (valid()) this.deps.logout(); });
    });
  }
}

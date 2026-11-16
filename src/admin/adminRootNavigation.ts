import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export type AdminRootNavigationContext = {
  isCurrent: () => boolean;
  destination: (route: string) => string | null;
  currentPath: () => string | null;
  containsPath: (path: string) => boolean;
  unfocus: () => void;
  popTo: (path: string) => void;
  push: (path: string) => void;
};

/** @v2 AppRootNavigation.replaceRootRoute */
export class AdminRootNavigation {
  private pending: { route: string; context: AdminRootNavigationContext } | null = null;
  constructor(private readonly afterFrame: (callback: () => void) => void) {}
  schedule(route: string, context: AdminRootNavigationContext): void {
    if (!isSynchronouslyTrue(context.isCurrent)) return;
    const path = context.destination(route);
    if (!path || context.currentPath() === path || !isSynchronouslyTrue(context.isCurrent)) return;
    context.unfocus();
    if (!isSynchronouslyTrue(context.isCurrent)) return;
    if (this.pending) { this.pending.route = route; return; }
    // Source keeps the first context and the last target selected during this frame.
    this.pending = { route, context };
    this.afterFrame(() => {
      const pending = this.pending; this.pending = null;
      if (!pending || !isSynchronouslyTrue(pending.context.isCurrent)) return;
      const target = pending.context.destination(pending.route), current = pending.context.currentPath();
      if (!target || current === null || current === target) return;
      const exists = pending.context.containsPath(target);
      if (!isSynchronouslyTrue(pending.context.isCurrent) || pending.context.destination(pending.route) !== target ||
        !isSynchronouslyTrue(pending.context.isCurrent)) return;
      if (exists) pending.context.popTo(target); else pending.context.push(target);
    });
  }
}

/** Shared by Admin dock instances, just as the V2 helper coalesces across screen contexts. */
export const adminRootNavigation = new AdminRootNavigation(callback => { requestAnimationFrame(callback); });

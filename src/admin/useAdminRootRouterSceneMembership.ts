import { useLayoutEffect, useMemo } from 'react';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';
import type { AdminRootRouterController } from './adminRootRouterController';

/** Real committed descriptor membership only. A parent renderer publication is not a native presentation receipt. */
export class AdminRootRouterSceneMembership {
  private active = false; private rendered = false; private attaching = false; private detach: (() => void) | null = null; private stop: (() => void) | null = null;
  constructor(private readonly controller: AdminRootRouterController, private readonly binding: AdminRootRouterBinding) {}
  commit(rendered: boolean) { this.rendered = rendered; if (!rendered) { const detach = this.detach; this.detach = null; detach?.(); } else this.retry(); }
  private retry = () => {
    if (!this.active || !this.rendered || this.detach || this.attaching) return; this.attaching = true;
    try { const detach = this.controller.attachScene(this.binding); if (!detach) return; if (!this.active || !this.rendered) detach(); else this.detach = detach; }
    finally { this.attaching = false; }
  };
  attach = () => {
    if (this.active) return () => {}; this.active = true;
    this.stop = this.controller.subscribe(this.retry); this.retry();
    return () => { this.active = false; this.stop?.(); this.stop = null; const detach = this.detach; this.detach = null; detach?.(); };
  };
}
/** Called only by the actual NativeScene render. Null/omitted descriptor bodies cannot acquire a lease through a later controller publication. */
export function useAdminRootRouterSceneMembership(controller: AdminRootRouterController, binding: AdminRootRouterBinding, rendered: boolean) {
  const owner = useMemo(() => new AdminRootRouterSceneMembership(controller, binding), [controller, binding]);
  useLayoutEffect(() => { owner.commit(rendered); }, [owner, rendered]);
  useLayoutEffect(() => owner.attach(), [owner]);
}

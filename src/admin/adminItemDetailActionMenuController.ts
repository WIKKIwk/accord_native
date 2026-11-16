import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminItemDetailActions, type AdminItemDetailAction, type AdminItemDetailActionMenuTicket } from './adminItemDetailActionMenuModel';
import type { AdminItemDetail } from './adminItemDetailModel';
import type { AdminItemDetailDecisionController } from './adminItemDetailDecisionController';

export type AdminItemDetailActionMenu = Readonly<{ ticket: AdminItemDetailActionMenuTicket; closing: boolean }>;
export type AdminItemDetailActionMenuState = Readonly<{ menus: readonly AdminItemDetailActionMenu[]; invalidated: boolean }>;
export type AdminItemDetailActionMenuClose = Readonly<{ id: number }>;
type Dependencies = Readonly<{
  isCurrent: (generation: number) => boolean;
  capture: (detail: AdminItemDetail) => AdminItemDetailActionMenuTicket | null;
  continue: (ticket: AdminItemDetailActionMenuTicket, action: AdminItemDetailAction | null) => Promise<number | null>;
  discard: (ticket: AdminItemDetailActionMenuTicket) => void;
}>;
/** Root native host contract: hide this exact menu first; only its genuine native completion may continue the captured Source action. */
export class AdminItemDetailActionMenuController {
  private state: AdminItemDetailActionMenuState = Object.freeze({ menus: Object.freeze([]), invalidated: false });
  private active = false; private retired = false; private checking = false; private generation = 0; private settling: object | null = null;
  private closes = new WeakMap<AdminItemDetailActionMenuClose, { generation: number; menu: AdminItemDetailActionMenu; action: AdminItemDetailAction | null }>();
  private closing = new Map<AdminItemDetailActionMenuTicket, AdminItemDetailActionMenuClose>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(menus: readonly AdminItemDetailActionMenu[], invalidated = this.retired): void {
    this.state = Object.freeze({ menus: Object.freeze([...menus]), invalidated }); for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(() => this.deps.isCurrent(generation)); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; this.isCurrent(); }
  request(detail: AdminItemDetail, generation = this.generation): AdminItemDetailActionMenuTicket | null {
    if (!this.isCurrent(generation) || this.settling || this.closing.size) return null;
    const ticket = this.deps.capture(detail);
    if (!this.isCurrent(generation)) { if (ticket) this.deps.discard(ticket); return null; }
    if (!ticket) return null;
    const menu = Object.freeze({ ticket, closing: false }); this.publish([...this.state.menus, menu]);
    return this.isCurrent(generation) && this.state.menus.includes(menu) ? ticket : null;
  }
  prepareClose(ticket: AdminItemDetailActionMenuTicket, action: AdminItemDetailAction | null): AdminItemDetailActionMenuClose | null {
    if (!this.isCurrent() || this.settling || this.closing.has(ticket)) return null;
    const menu = this.state.menus[this.state.menus.length - 1]; if (menu?.ticket !== ticket || action !== null && (!adminItemDetailActions.includes(action) || ticket.kind === 'combo')) return null;
    const close = Object.freeze({ id: ticket.id }); this.closes.set(close, { generation: this.generation, menu, action }); this.closing.set(ticket, close);
    this.publish(this.state.menus.map(value => value === menu ? Object.freeze({ ...menu, closing: true }) : value)); return close;
  }
  async completeClose(close: AdminItemDetailActionMenuClose): Promise<number | null> {
    const captured = this.closes.get(close);
    if (!captured || !this.isCurrent(captured.generation) || this.closing.get(captured.menu.ticket) !== close) return null;
    this.closes.delete(close); this.closing.delete(captured.menu.ticket); const settling = {}; this.settling = settling;
    this.publish(this.state.menus.filter(menu => menu.ticket !== captured.menu.ticket));
    let forwarded = false;
    try {
      if (!this.isCurrent(captured.generation)) return null;
      const pending = this.deps.continue(captured.menu.ticket, captured.action); forwarded = true;
      if (this.settling === settling) this.settling = null;
      const result = await pending; return this.isCurrent(captured.generation) ? result : null;
    } finally { if (!forwarded) this.deps.discard(captured.menu.ticket); if (this.settling === settling) this.settling = null; }
  }
  private clear(): void {
    const menus = this.state.menus; this.closes = new WeakMap(); this.closing.clear(); this.settling = null;
    for (const menu of menus) this.deps.discard(menu.ticket);
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.clear(); this.publish([]); }
  dispose(): void { this.active = false; this.generation++; this.clear(); this.publish([]); }
}
/** Genuine composition over the decision owner; no default/no-op navigation or menu action callback is supplied. */
export function createAdminItemDetailActionMenus(controller: Pick<AdminItemDetailDecisionController, 'interactionGeneration' | 'isCurrent' | 'captureActionMenu' | 'continueActionMenu' | 'discardActionMenu'>) {
  let bound: { menuGeneration: number; parentGeneration: number } | null = null;
  return new AdminItemDetailActionMenuController({ isCurrent: menuGeneration => {
    if (bound?.menuGeneration !== menuGeneration) {
      if (!controller.isCurrent()) return false; bound = { menuGeneration, parentGeneration: controller.interactionGeneration };
    }
    return controller.isCurrent(bound.parentGeneration);
  },
    capture: detail => controller.captureActionMenu(detail), continue: (ticket, action) => controller.continueActionMenu(ticket, action),
    discard: ticket => controller.discardActionMenu(ticket) });
}

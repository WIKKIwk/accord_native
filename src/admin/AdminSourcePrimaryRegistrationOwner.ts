import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { createProfileSessionGuard, type ProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminCreateHubController, AdminCreateHubPrimaryPresentation, AdminCreateHubTicket } from './adminCreateHubController';

export type AdminSourcePrimaryRegistration = Readonly<{ identity: object; controller: AdminCreateHubController; isCurrent: () => boolean; canInteract: () => boolean }>;
/** One actual Source dock registration through blur. Only presentation fields rebuild; original native-command authority never retargets. */
export class AdminSourcePrimaryRegistrationOwner {
  private readonly original: AdminSourcePrimaryRegistration; private presentation: AdminCreateHubPrimaryPresentation;
  private readonly listeners = new Set<() => void>(); private active = false; private retired = false; private checking = false; private focused: boolean | null = null;
  private generation = 0; private ticket: AdminCreateHubTicket | null = null;
  private stopHub: (() => void) | null = null; private registering = false;
  private readonly interaction: ProfileSessionGuard; private updating: { valid: boolean } | null = null;
  private sourceActions: AdminCreateHubPrimaryPresentation['actions']; private actions: AdminCreateHubPrimaryPresentation['actions'];
  constructor(original: AdminSourcePrimaryRegistration, presentation: AdminCreateHubPrimaryPresentation) {
    if (!original.identity || typeof original.identity !== 'object' || Array.isArray(original.identity) || !original.controller || typeof original.controller.register !== 'function' ||
      typeof original.isCurrent !== 'function' || typeof original.canInteract !== 'function') throw TypeError('The original global Hub and genuine Source dock guards are required');
    this.original = Object.freeze({ ...original }); this.interaction = createProfileSessionGuard(original.canInteract); this.presentation = this.copyPresentation(presentation);
  }
  private copyPresentation(presentation: AdminCreateHubPrimaryPresentation): AdminCreateHubPrimaryPresentation {
    const { showPrimaryFab, actions, hasReplacement, replacement } = presentation;
    if (actions !== this.sourceActions) { this.sourceActions = actions; this.actions = actions ? Object.freeze(actions.map(action => Object.freeze({ ...action, icon: Object.freeze({ ...action.icon }) }))) : undefined; }
    return Object.freeze({ showPrimaryFab, actions: this.actions, hasReplacement, replacement });
  }
  getSnapshot = () => this.ticket;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(ticket: AdminCreateHubTicket | null) { if (this.ticket === ticket) return; this.ticket = ticket; for (const listener of [...this.listeners]) { try { listener(); } catch {} } }
  matches = (original: AdminSourcePrimaryRegistration) => original.identity === this.original.identity && original.controller === this.original.controller && original.isCurrent === this.original.isCurrent && original.canInteract === this.original.canInteract;
  commit(original: AdminSourcePrimaryRegistration) { if (!this.matches(original)) this.invalidate(); }
  commitFocus(focused: boolean) { if (!this.retired && typeof focused === 'boolean') this.focused = focused; }
  private current = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const valid = isSynchronouslyTrue(this.original.isCurrent); this.checking = false;
    if (!valid) { this.invalidate(); return false; } return this.active && !this.retired && generation === this.generation;
  };
  canInteract = (generation = this.generation): boolean => this.ticket !== null && this.focused === true && this.current(generation) && this.interaction() && this.current(generation);
  start() {
    if (this.active || this.retired) return; this.active = true; const generation = ++this.generation;
    this.stopHub = this.original.controller.subscribe(() => {
      if (!this.active || this.retired || this.registering) return;
      if (!this.ticket) { if (this.original.controller.getSnapshot().valid) this.register(generation); }
      else if (!this.original.controller.primaryFor(this.ticket)) this.invalidate();
    });
    this.register(generation);
  }
  private register(generation: number) {
    if (!this.current(generation) || this.ticket || this.registering) return; this.registering = true;
    try {
    const ticket = this.original.controller.register(Object.freeze({ ...this.presentation, isCurrent: () => this.current(generation),
      isFocused: () => this.focused === true && this.current(generation),
      canInteract: () => this.canInteract(generation) }));
    if (!ticket) return;
    if (!this.current(generation)) { this.original.controller.unregister(ticket); return; } this.publish(ticket);
    } finally { this.registering = false; }
  }
  update(presentation: AdminCreateHubPrimaryPresentation) {
    if (this.retired) return false; if (this.updating) { this.updating.valid = false; return false; }
    const frame = { valid: true }; this.updating = frame;
    try {
      const next = this.copyPresentation(presentation); if (!frame.valid || this.retired) return false;
      // Remember ordinary committed Source data before the passive registration; this grants no ticket or command authority.
      if (!this.active) { this.presentation = next; return true; }
      if (!this.current() || !this.ticket || !this.original.controller.updatePrimary(this.ticket, next) || !this.current() || !frame.valid) return false;
      this.presentation = next; return true;
    } catch { return false; } finally { this.updating = null; }
  }
  detach = () => { this.active = false; this.focused = null; this.generation++; this.stopHub?.(); this.stopHub = null; const ticket = this.ticket; this.publish(null); if (ticket) this.original.controller.unregister(ticket); };
  invalidate() { if (this.retired) return; this.retired = true; this.detach(); }
}

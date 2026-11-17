import type { AdminRootRouterPageContext } from './AdminRootRouterContext';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';
import type { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import type { useAdminTopNoticeTarget } from './AdminTopNoticeProvider';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminSourcePrimaryRegistrationOwner } from './AdminSourcePrimaryRegistrationOwner';

export type AdminSourceSceneOriginal = Readonly<{ root: AdminRootRouterPageContext; binding: AdminRootRouterBinding;
  source: AdminSourceDockScaffoldOwner; target: ReturnType<typeof useAdminTopNoticeTarget> }>;
export type AdminSourceSceneSnapshot = Readonly<{ phase: 'pending' | 'active' | 'retired'; generation: number; revision: number }>;
const issued = new WeakSet<object>();
/** A scene READ lease, never native readiness. It reuses the caller's existing Source ticket without creating/attaching another Scaffold. */
export class AdminSourceSceneScaffoldOwner {
  private readonly original: AdminSourceSceneOriginal;
  private readonly members = new Set<object>(); private readonly listeners = new Set<() => void>(); private stops: (() => void)[] = [];
  private passive = false; private checking: { valid: boolean; resourceChanged: boolean } | null = null; private resourceRetry = false;
  private disconnectPrimary: (() => void) | null = null;
  private readonly interaction: () => boolean;
  private readonly primaryInteraction: () => boolean;
  private state: AdminSourceSceneSnapshot = Object.freeze({ phase: 'pending', generation: 0, revision: 0 });
  constructor(original: AdminSourceSceneOriginal) {
    this.original = Object.freeze({ ...original, root: Object.freeze({ ...original.root }), target: Object.freeze({ ...original.target }) });
    this.interaction = createProfileSessionGuard(() => this.original.root.controller.canInteract(this.original.binding));
    this.primaryInteraction = createProfileSessionGuard(() => this.original.source.hubRequest()?.canOpenPrimary() === true);
    if (!this.structure()) throw TypeError('The exact original Root scene and its genuine Source Scaffold binding are required'); issued.add(this);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(phase: AdminSourceSceneSnapshot['phase'], newGeneration = false) {
    this.state = Object.freeze({ phase, generation: this.state.generation + (newGeneration ? 1 : 0), revision: this.state.revision + 1 });
    for (const listener of [...this.listeners]) { try { listener(); } catch {} }
  }
  private structure() {
    try {
      const { root, binding, source, target } = this.original, witness = source.sourceWitness(), container = root.controller.container(binding);
      return root.binding === binding && witness.rootBinding === binding && witness.identity === binding.identity && !!container && container.sourceScaffoldAncestor === witness.sourceScaffoldAncestor &&
        witness.scaffold.ticket !== null && witness.scaffold.messenger === target.messenger && witness.scaffold.progress === target.progress && typeof target.progress?.get === 'function' &&
        typeof root.controller.hasScene === 'function' && typeof root.controller.sourceCurrent === 'function' && typeof root.controller.subscribeSource === 'function' && typeof root.controller.subscribeResource === 'function';
    } catch { return false; }
  }
  matches(original: AdminSourceSceneOriginal) {
    return original.root?.controller === this.original.root.controller && original.root?.binding === this.original.root.binding && original.binding === this.original.binding && original.source === this.original.source &&
      original.target?.messenger === this.original.target.messenger && original.target?.progress === this.original.target.progress && this.structure();
  }
  commit(original: AdminSourceSceneOriginal) { if (!this.matches(original)) this.invalidate(); }
  accepts(root: AdminRootRouterPageContext | null, binding: AdminRootRouterBinding | undefined, ancestor: AdminTopNoticeScaffold | null) {
    return issued.has(this) && root?.controller === this.original.root.controller && root?.binding === this.original.binding && binding === this.original.binding &&
      ancestor === this.original.source.sourceWitness().sourceScaffoldAncestor && this.structure();
  }
  attach = () => {
    if (this.state.phase === 'retired') return () => {};
    const member = {}; this.members.add(member);
    if (this.members.size === 1) {
      this.publish('pending', true);
      const { root, source, target } = this.original;
      this.stops = [root.controller.subscribeSource(this.refresh), root.controller.subscribeResource(this.refreshResource), source.subscribe(this.refresh), target.messenger.subscribe(this.refresh)];
    }
    let detached = false;
    return () => { if (detached) return; detached = true; this.members.delete(member); if (!this.members.size) { this.passive = false; this.stop(); if (this.state.phase !== 'retired') this.publish('pending', true); } };
  };
  start = () => { if (this.state.phase === 'retired' || !this.members.size) return; this.passive = true; this.refresh(); };
  private releasePrimary() { const stop = this.disconnectPrimary; this.disconnectPrimary = null; stop?.(); }
  private stop() { this.releasePrimary(); const stops = this.stops; this.stops = []; stops.forEach(stop => { try { stop(); } catch {} }); }
  private suspend() { if (this.state.phase === 'active') { this.publish('pending', true); this.releasePrimary(); } }
  private retryResource() {
    if (this.resourceRetry) return; this.resourceRetry = true;
    // A genuine resource publication happened inside an original guard. Retry its actual memberships after that frame, never invent readiness.
    queueMicrotask(() => { this.resourceRetry = false; if (this.members.size && this.passive && this.state.phase !== 'retired') this.refresh(); });
  }
  private refreshResource = () => {
    if (this.checking) { this.checking.resourceChanged = true; this.retryResource(); return; } this.refresh();
  };
  private refresh = () => {
    if (this.checking) { this.checking.valid = false; return; }
    if (!this.members.size || !this.passive || this.state.phase === 'retired') return;
    if (this.check(this.state.generation, true)) this.publish('active');
  };
  private check(generation: number, activate: boolean): boolean {
    if (this.state.phase === 'retired' || !this.passive || !this.members.size || generation !== this.state.generation) return false;
    if (this.checking) { this.checking.valid = false; return false; }
    const frame = { valid: true, resourceChanged: false }; this.checking = frame;
    let lifetime = false, scene = false, valid = false;
    try {
      const { root, source, target, binding } = this.original, witness = source.sourceWitness(), membership = source.sourceMembership();
      lifetime = this.structure() && !membership.retired && root.controller.sourceCurrent(binding) && target.messenger.current();
      if (lifetime && membership.active) {
        // The actual container now supplies Source-only read authority; it does not conflate a renderer gap with account retirement.
        lifetime = source.current(membership.generation) && root.controller.sourceCurrent(binding);
        scene = root.controller.hasScene(binding) && target.messenger.isRootScaffold(witness.scaffold.ticket!); valid = lifetime && scene;
      }
    } catch { lifetime = false; } finally { this.checking = null; }
    const membership = this.original.source.sourceMembership();
    if (!lifetime || membership.retired || !frame.valid) { this.invalidate(); return false; }
    if (!membership.active || !scene || frame.resourceChanged) { this.suspend(); if (frame.resourceChanged) this.retryResource(); return false; }
    if (!valid) { this.invalidate(); return false; }
    if (this.state.phase === 'pending') { if (!activate) return false; this.publish('active'); }
    return this.state.phase === 'active' && this.passive && this.members.size > 0 && generation === this.state.generation && !membership.retired;
  }
  readCurrent = (generation = this.state.generation): boolean => this.check(generation, false);
  canInteract = (generation = this.state.generation) => this.readCurrent(generation) && this.interaction() && this.readCurrent(generation);
  /** New dock intent only. Original read/registration and an already accepted Add do not use this geometry/host fence. */
  canOpenPrimary = (generation = this.state.generation) => this.canInteract(generation) && this.primaryInteraction() && this.readCurrent(generation);
  primaryIdentity = () => this.original.binding.identity;
  connectPrimary(registration: AdminSourcePrimaryRegistrationOwner, generation: number): (() => void) | null {
    if (this.disconnectPrimary || !this.readCurrent(generation)) return null;
    const detach = this.original.source.connectPrimary(registration, this.original.binding);
    if (!detach) return null; if (!this.readCurrent(generation)) { detach(); return null; }
    const stop = () => { if (this.disconnectPrimary !== stop) return; this.disconnectPrimary = null; detach(); }; this.disconnectPrimary = stop; return stop;
  }
  readScaffold(generation = this.state.generation): AdminTopNoticeScaffoldBinding | null {
    if (!this.readCurrent(generation)) return null;
    // All account/member callbacks complete before this single pure Source snapshot read.
    // Reading bannerFor/current after capture could mix a new head with an older accessibility fact.
    const { target, source } = this.original, ticket = source.sourceWitness().scaffold.ticket!, state = target.messenger.getSnapshot();
    return Object.freeze({ messenger: target.messenger, progress: target.progress, ticket, banner: target.messenger.isRootScaffold(ticket) ? state.head : null, accessibleNavigation: state.accessibleNavigation });
  }
  invalidate = () => { if (this.state.phase === 'retired') return; this.passive = false; this.stop(); this.publish('retired', true); };
}
export function isAdminSourceSceneScaffoldOwner(value: unknown): value is AdminSourceSceneScaffoldOwner { return !!value && typeof value === 'object' && issued.has(value); }

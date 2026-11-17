import type { AdminScaffoldMarker } from '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import type { AdminCreateHubController, AdminCreateHubTicket } from './adminCreateHubController';
import type { AdminScaffoldLayoutBinding, AdminScaffoldLayoutBindingSnapshot } from './adminFixedSnackBarReader';
import { adminSourceDockBodyBottom, adminSourceDockSizing, type AdminSourceDockPrimary, type AdminSourceDockSizing } from './adminSourceDockScaffoldPolicy';
import type { AdminSourceDockHubRequest, AdminSourceDockScaffoldProps } from './AdminSourceDockScaffoldTypes';
import { adminSourcePrimaryRegistrationTransport, type AdminSourcePrimaryRegistrationOwner } from './AdminSourcePrimaryRegistrationOwner';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';

type Host = Pick<AdminSourceDockScaffoldProps, 'identity' | 'reader' | 'scaffold' | 'sourceScaffoldAncestor' | 'isCurrent' | 'canInteract' | 'hubNativeHost' | 'rootBinding'>;
export type AdminSourceDockTarget = Readonly<{ identity: object; nativeID: string; primary: AdminSourceDockPrimary; sizing: AdminSourceDockSizing }>;
export type AdminSourceDockSnapshot = Readonly<{ revision: number; generation: number; retired: boolean; native: AdminScaffoldLayoutBindingSnapshot | null;
  target: AdminSourceDockTarget | null; bodyBottom: number | null; geometryReady: boolean }>;
/** Original Reader/native marker lifetime. It never owns a new Hub session or acknowledges layout from a scalar/onLayout alone. */
export class AdminSourceDockScaffoldOwner {
  readonly viewportID = createAdminPresentationWindowTicket();
  private readonly original: Host; private readonly listeners = new Set<() => void>(); private active = false; private checking = false; private retired = false;
  private readonly hostReference: Host['hubNativeHost'];
  private refreshing = false; private refreshAgain = false; private hostFrame: { valid: boolean } | null = null;
  private interactionFrame: { valid: boolean } | null = null;
  private layout: Readonly<{ metrics: AdminScaffoldLayoutBindingSnapshot['metrics']; hostHeight: number | null }> = Object.freeze({ metrics: null, hostHeight: null });
  private binding: AdminScaffoldLayoutBinding | null = null; private stopBinding: (() => void) | null = null; private stopHub: (() => void) | null = null;
  private ticket: AdminCreateHubTicket | null = null; private thin: boolean | null = null; private dockTarget: AdminSourceDockTarget | null = null;
  private primary: Readonly<{ registration: AdminSourcePrimaryRegistrationOwner; stop: () => void }> | null = null;
  private state: AdminSourceDockSnapshot = Object.freeze({ revision: 0, generation: 0, retired: false, native: null, target: null, bodyBottom: null, geometryReady: false });
  constructor(props: Host, readonly hub: AdminCreateHubController) {
    if (!props.identity || typeof props.identity !== 'object' || Array.isArray(props.identity) || !props.reader || typeof props.reader.registerScaffold !== 'function' ||
      !props.scaffold?.messenger || !props.scaffold.ticket || props.sourceScaffoldAncestor !== null && (!props.sourceScaffoldAncestor || typeof props.sourceScaffoldAncestor !== 'object') ||
      typeof props.isCurrent !== 'function' || typeof props.canInteract !== 'function' || !hub || typeof hub.primaryFor !== 'function') throw TypeError('Original global Hub, actual Source Scaffold and Reader owner are required');
    if (props.hubNativeHost && (!props.hubNativeHost.identity || typeof props.hubNativeHost.identity !== 'object' ||
      ['isAvailable', 'ownsOverlayTop', 'renderPrimary', 'renderOverlay'].some(key => typeof props.hubNativeHost![key as keyof NonNullable<Host['hubNativeHost']>] !== 'function'))) throw TypeError('The actual original-window Hub host capability is required');
    this.hostReference = props.hubNativeHost;
    this.original = Object.freeze({ ...props, scaffold: Object.freeze({ ...props.scaffold }), hubNativeHost: props.hubNativeHost ? Object.freeze({ ...props.hubNativeHost }) : null });
  }
  matches = (props: Host) => props.identity === this.original.identity && props.reader === this.original.reader && props.scaffold.messenger === this.original.scaffold.messenger &&
    props.scaffold.ticket === this.original.scaffold.ticket && props.scaffold.progress === this.original.scaffold.progress && props.rootBinding === this.original.rootBinding && props.sourceScaffoldAncestor === this.original.sourceScaffoldAncestor && props.isCurrent === this.original.isCurrent && props.canInteract === this.original.canInteract && props.hubNativeHost === this.hostReference &&
    (!props.hubNativeHost || ['identity', 'isAvailable', 'ownsOverlayTop', 'renderPrimary', 'renderOverlay'].every(key => props.hubNativeHost![key as keyof NonNullable<Host['hubNativeHost']>] === this.original.hubNativeHost![key as keyof NonNullable<Host['hubNativeHost']>]));
  commit(props: Host) { if (!this.matches(props)) this.invalidate(); }
  getSnapshot = () => this.state;
  nativeHost = () => this.original.hubNativeHost;
  sourceWitness = () => this.original;
  sourceMembership = () => Object.freeze({ active: this.active, retired: this.retired, generation: this.state.generation });
  connectPrimary(registration: AdminSourcePrimaryRegistrationOwner, binding: AdminRootRouterBinding): (() => void) | null {
    const transport = adminSourcePrimaryRegistrationTransport(registration);
    if (!this.active || this.retired || !this.original.rootBinding || binding !== this.original.rootBinding || this.primary || !transport) return null;
    const witness = transport.original; if (witness.controller !== this.hub || witness.identity !== binding.identity || !this.current()) return null;
    const refresh = () => { if (this.primary?.registration !== registration || !this.active || this.retired) return; this.ticket = transport.getSnapshot(); this.refresh(); };
    const lease = { registration, stop: transport.subscribe(refresh) }; this.primary = lease; refresh();
    return () => { if (this.primary !== lease) return; this.primary = null; lease.stop(); this.ticket = null; this.refresh(); };
  }
  sourceLayout(available: boolean) {
    const known = available && this.state.geometryReady, metrics = known ? this.state.native?.metrics ?? null : null, hostHeight = known ? this.state.native?.dockHeight ?? null : null;
    if (this.layout.metrics !== metrics || this.layout.hostHeight !== hostHeight) this.layout = Object.freeze({ metrics, hostHeight });
    return this.layout;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminSourceDockSnapshot>) { this.state = Object.freeze({ ...this.state, ...patch, revision: this.state.revision + 1 }); for (const listener of [...this.listeners]) { try { listener(); } catch {} } }
  current = (generation = this.state.generation): boolean => {
    if (!this.active || this.retired || generation !== this.state.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.original.isCurrent) && this.original.scaffold.messenger.current(); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.state.generation;
  };
  canInteract = (generation = this.state.generation): boolean => {
    if (!this.current(generation) || !this.state.geometryReady) return false;
    if (this.interactionFrame) { this.interactionFrame.valid = false; return false; }
    const frame = { valid: true }; this.interactionFrame = frame; const valid = isSynchronouslyTrue(this.original.canInteract); this.interactionFrame = null;
    return valid && frame.valid && this.current(generation) && this.state.geometryReady;
  };
  hubRequest(): AdminSourceDockHubRequest | null {
    const snapshot = this.state, target = snapshot.target, native = snapshot.native, state = this.hub.getSnapshot(), generation = snapshot.generation;
    if (!target || !snapshot.geometryReady || !native?.windowIdentity || !this.current(generation)) return null;
    const request: AdminSourceDockHubRequest = Object.freeze({ controller: this.hub, ticket: target.primary.ticket, primary: target.primary, state,
      windowIdentity: native.windowIdentity, sizing: target.sizing,
      isCurrent: () => this.current(generation) && this.state.target === target && this.state.geometryReady && this.state.native?.windowIdentity === native.windowIdentity && this.hub.getSnapshot() === state,
      canOpenPrimary: () => target.primary.visible && target.primary.ready && state.overlay === null && this.hostAvailable(request) && this.canInteract(generation) && request.isCurrent(),
    });
    return request.isCurrent() ? request : null;
  }
  hostAvailable(request: AdminSourceDockHubRequest | null): boolean {
    if (!request || !this.original.hubNativeHost || !request.isCurrent() || request.primary.visible && !request.primary.ready) return false;
    return this.checkHost(request, () => this.original.hubNativeHost!.isAvailable(request));
  }
  ownsOverlayTop(request: AdminSourceDockHubRequest | null): boolean {
    if (!request?.state.overlay || !this.hostAvailable(request)) return false;
    return this.checkHost(request, () => this.original.hubNativeHost!.ownsOverlayTop(request));
  }
  private checkHost(request: AdminSourceDockHubRequest, callback: () => boolean) {
    if (this.hostFrame) { this.hostFrame.valid = false; return false; }
    const frame = { valid: true }; this.hostFrame = frame; const valid = isSynchronouslyTrue(callback); this.hostFrame = null;
    return valid && frame.valid && request.isCurrent();
  }
  start() {
    if (this.active || this.retired) return; this.active = true; this.publish({ generation: this.state.generation + 1 });
    this.stopHub = this.hub.subscribe(() => this.refresh()); this.refresh();
  }
  detach = () => {
    this.active = false; const primary = this.primary; this.primary = null; primary?.stop(); if (this.original.rootBinding) this.ticket = null;
    this.stopHub?.(); this.stopHub = null; this.stopBinding?.(); this.stopBinding = null; const binding = this.binding; this.binding = null; this.dockTarget = null;
    binding?.dispose(); this.publish({ generation: this.state.generation + 1, native: null, target: null, bodyBottom: null, geometryReady: false });
  };
  invalidate() { if (this.retired) return; this.retired = true; this.detach(); this.publish({ retired: true }); }
  source(ticket: AdminCreateHubTicket | null | undefined, thinGestureBottom: boolean | null) {
    if (this.retired) return; if (!this.original.rootBinding) this.ticket = ticket ?? null; this.thin = thinGestureBottom; this.refresh();
  }
  bindViewport(marker: AdminScaffoldMarker, generation = this.state.generation) {
    if (!this.current(generation) || this.binding || marker.nativeID !== this.viewportID) return;
    const binding = this.original.reader.registerScaffold({ scaffold: this.original.scaffold.ticket!, viewportMarker: marker, isCurrent: () => this.current(generation) });
    if (!binding) return; if (!this.current(generation)) { binding.dispose(); return; } this.binding = binding;
    this.stopBinding = binding.subscribe(() => this.refresh()); this.refresh();
  }
  bindDock(marker: AdminScaffoldMarker, target: AdminSourceDockTarget, generation = this.state.generation) {
    if (!this.current(generation) || !this.binding || this.state.target !== target || marker.nativeID !== target.nativeID) return;
    this.dockTarget = target; this.binding.setDockMarker(marker); this.refresh();
  }
  private refresh() {
    if (this.refreshing) { this.refreshAgain = true; return; }
    this.refreshing = true;
    try {
      // Native marker replacement legitimately publishes synchronously. Malicious guard/listener loops cannot spin forever.
      let turns = 0;
      do { this.refreshAgain = false; this.refreshNow(); if (++turns > 16 && this.refreshAgain) { this.invalidate(); break; } } while (this.refreshAgain && !this.retired);
    } finally { this.refreshing = false; this.refreshAgain = false; }
  }
  private refreshNow() {
    if (!this.current()) return; const generation = this.state.generation, binding = this.binding, native = binding?.getSnapshot() ?? null;
    if (native?.phase === 'retired') { this.invalidate(); return; }
    const primary = this.ticket ? this.hub.primaryFor(this.ticket) : null, sizing = adminSourceDockSizing(native?.metrics ?? null, this.thin, primary);
    if (!this.current(generation) || this.binding !== binding) return;
    const old = this.state.target, sameGeometry = !!old && !!sizing && primary?.ticket === old.primary.ticket &&
      Object.keys(sizing).every(key => sizing[key as keyof AdminSourceDockSizing] === old.sizing[key as keyof AdminSourceDockSizing]);
    const samePresentation = !!old && !!primary && primary.visible === old.primary.visible && primary.ready === old.primary.ready && primary.hasPrimary === old.primary.hasPrimary &&
      primary.replacement === old.primary.replacement && primary.replacementValue === old.primary.replacementValue;
    const target = sameGeometry && old && primary ? samePresentation ? old : Object.freeze({ ...old, primary }) : sizing && primary ? Object.freeze({ identity: {}, nativeID: createAdminPresentationWindowTicket(), primary, sizing }) : null;
    if (!sameGeometry && target !== old) {
      this.dockTarget = null; this.publish({ native, target, geometryReady: false, bodyBottom: null });
      if (this.current(generation) && this.binding === binding && this.state.target === target) binding?.setDockMarker(null);
      return;
    }
    const geometryReady = !!target && this.dockTarget?.identity === target.identity && native?.phase === 'bound' && !!native.windowIdentity && native.metrics !== null && native.dockHeight !== null;
    this.publish({ native, target, geometryReady, bodyBottom: geometryReady ? adminSourceDockBodyBottom(native?.metrics ?? null, native?.dockHeight ?? null) : null });
  }
}

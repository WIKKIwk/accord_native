import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import type { AdminRootRouterBinding, AdminRootRouterDescriptor, AdminRootRouterFrame, AdminRootRouterPage, AdminRootRouterPageRequest, AdminRootRouterRootOptions, AdminRootRouterScene, AdminRootRouterSceneRenderer } from './AdminRootRouterTypes';
import type { NavigationState } from 'expo-router';

type Page = { value: AdminRootRouterPage; request: AdminRootRouterPageRequest; binding: AdminRootRouterBinding | null; scene: AdminRootRouterScene | null;
  members: Set<object>; hadScene: boolean; retired: boolean; checking: boolean; closing: boolean; nativeClosed: boolean; logicalGone: boolean; settled: boolean;
  resolve: (value: 'closed' | 'retired') => void };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function stack(value: unknown): value is NavigationState {
  try { return object(value) && value.type === 'stack' && key(value.key) && Number.isInteger(value.index) && typeof value.index === 'number' && value.index >= 0 && Array.isArray(value.routes) && value.index < value.routes.length && Array.isArray(value.routeNames) &&
    value.routes.every(route => object(route) && key(route.key) && key(route.name)) && new Set(value.routes.map(route => route.key)).size === value.routes.length; } catch { return false; }
}
function descriptor(value: unknown): value is AdminRootRouterDescriptor {
  if (!object(value) || !object(value.route) || !key(value.route.key) || !key(value.route.name) || !object(value.options) || typeof value.render !== 'function' || !object(value.navigation)) return false;
  return ['getState', 'dispatch', 'setOptions', 'isFocused', 'getParent'].every(name => typeof (value.navigation as Record<string, unknown>)[name] === 'function');
}
function validFrame(frame: AdminRootRouterFrame): boolean {
  try { const s = frame.state;
    return stack(s) && object(frame.descriptors) && [frame.navigation?.getState, frame.navigation?.dispatch, frame.emit, frame.isPreloaded, frame.isRemovalPrevented].every(value => typeof value === 'function');
  } catch { return false; }
}

/** Actual route descriptors plus original Root windows. It never creates a page body, focus value, or native receipt. */
export class AdminRootRouterController {
  readonly chain: AdminRootRouterRootOptions['chain']; private readonly options: AdminRootRouterRootOptions;
  private frame: AdminRootRouterFrame | null = null; private root: AdminRootRouterScene | null = null; private renderer: AdminRootRouterSceneRenderer | null = null;
  private readonly rendererMembers = new Set<object>(); private readonly pages = new Map<AdminRootRouterPage, Page>();
  private readonly rootSceneMembers = new Set<object>();
  private readonly nativePages = new Map<AdminRootRouterPage['native'], Page>();
  private readonly identities = new WeakSet<object>(); private readonly listeners = new Set<() => void>(); private version = 0;
  private readonly sourceListeners = new Set<() => void>(); private readonly resourceListeners = new Set<() => void>();
  private sourceRevision: object = {}; private resourceRevision: object = {};
  private retired = false; private checking = false; private issuing = false;
  private readonly unsubscribeChain: () => void;
  private readonly unsubscribeSource: () => void; private readonly unsubscribeResource: () => void;
  constructor(options: AdminRootRouterRootOptions) {
    if (!options?.chain || !key(options.rootRouteName) || typeof options.isCurrent !== 'function' || typeof options.onRequestClose !== 'function' || typeof options.renderSceneContainer !== 'function' || options.sourceScaffoldAncestor !== null && !object(options.sourceScaffoldAncestor)) throw TypeError('Original Root chain, actual Source container/ancestor, real root route and account authority are required');
    this.options = Object.freeze({ ...options }); this.chain = options.chain;
    this.unsubscribeSource = this.chain.subscribeSource(() => this.publish('source'));
    this.unsubscribeResource = this.chain.subscribeResource(() => this.publish('resource'));
    this.unsubscribeChain = this.chain.subscribe(() => {
      let resourceChanged = false;
      for (const [entry, page] of this.nativePages) if (page.settled && !this.chain.getSnapshot().resources.includes(entry)) { this.nativePages.delete(entry); resourceChanged = true; }
      if (this.retired && this.chain.getSnapshot().rootResource !== 'pending') { this.root = null; this.frame = null; this.renderer = null; this.stopResourceObservation(); resourceChanged = true; }
      this.publish(resourceChanged ? 'resource' : 'redraw');
    });
  }
  getSnapshot = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeSource = (listener: () => void) => { this.sourceListeners.add(listener); return () => { this.sourceListeners.delete(listener); }; };
  subscribeResource = (listener: () => void) => { this.resourceListeners.add(listener); return () => { this.resourceListeners.delete(listener); }; };
  sourceStamp = () => this.sourceRevision;
  resourceStamp = () => this.resourceRevision;
  private publish(kind: 'source' | 'resource' | 'both' | 'redraw' = 'source') {
    if (kind === 'source' || kind === 'both') this.sourceRevision = {};
    if (kind === 'resource' || kind === 'both') this.resourceRevision = {};
    this.version++; const listeners = [...(kind === 'source' || kind === 'both' ? this.sourceListeners : []), ...(kind === 'resource' || kind === 'both' ? this.resourceListeners : []), ...this.listeners];
    for (const listener of listeners) { try { listener(); } catch { /* An observer cannot complete a native/route fence. */ } }
  }
  current = () => {
    if (this.retired) return false; if (this.checking) { this.dispose(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.options.isCurrent) && this.chain.current(); this.checking = false;
    if (!valid || this.retired) { this.dispose(); return false; } return true;
  };
  attachRenderer(renderer: AdminRootRouterSceneRenderer): (() => void) | null {
    if (!this.current() || typeof renderer !== 'function' || this.renderer !== null && this.renderer !== renderer) return null;
    this.renderer = renderer; const member = {}; this.rendererMembers.add(member); this.publish('resource');
    return () => { if (!this.rendererMembers.delete(member)) return; this.publish('resource'); queueMicrotask(() => { if (!this.rendererMembers.size && this.renderer === renderer) this.dispose(); }); };
  }
  private page(value: unknown): Page | null { return this.pages.get(value as AdminRootRouterPage) ?? null; }
  private bound(binding: unknown): Page | null { return [...this.nativePages.values()].find(page => page.binding === binding) ?? null; }
  private original(page: Page): boolean {
    const valid = this.sourceOriginal(page); return valid && this.rendererMembers.size > 0;
  }
  private sourceOriginal(page: Page): boolean {
    if (page.retired || page.settled || this.pages.get(page.value) !== page || this.chain.sourceOutcome(page.value.native) === 'retired' || !this.current()) return false;
    if (page.checking) { this.retire(page); return false; } page.checking = true;
    const valid = isSynchronouslyTrue(page.request.isCurrent); page.checking = false;
    if (!valid || page.retired || !this.current()) { this.retire(page); return false; }
    return !page.retired && !page.settled && this.pages.get(page.value) === page && this.chain.sourceOutcome(page.value.native) !== 'retired';
  }
  private select(frame: AdminRootRouterFrame, routeKey: string): AdminRootRouterDescriptor | null {
    const index = frame.state.routes.findIndex(route => route.key === routeKey), actual = frame.state.routes[index], value = frame.descriptors[routeKey];
    if (index < 0 || index > frame.state.index || !actual || !descriptor(value) || value.route.key !== actual.key || value.route.name !== actual.name || frame.isPreloaded(routeKey)) return null;
    return value;
  }
  /** Real standard-navigator commit. Active routes only; preloads cannot acquire a native carrier. */
  commitFrame(frame: AdminRootRouterFrame): boolean {
    if (!this.current() || !this.rendererMembers.size || !validFrame(frame)) return false;
    try {
      const actual = frame.navigation.getState(); if (!stack(actual) || actual.key !== frame.state.key) return false;
      if (this.frame && (frame.state.key !== this.frame.state.key || frame.navigation !== this.frame.navigation)) { this.dispose(); return false; }
      const base = frame.state.routes[0], baseDescriptor = this.select(frame, base.key);
      if (base.name !== this.options.rootRouteName || !baseDescriptor || this.root && base.key !== this.root.binding.routeKey) { this.dispose(); return false; }
      const rootBinding = this.root?.binding ?? Object.freeze({ identity: Object.freeze({}), navigatorKey: frame.state.key, routeKey: base.key, routeName: base.name, id: null });
      this.frame = frame; this.root = Object.freeze({ binding: rootBinding, route: base, descriptor: baseDescriptor, frame });
      for (const page of this.pages.values()) {
        if (!this.original(page)) continue;
        const matches = frame.state.routes.slice(1, frame.state.index + 1).filter(route => route.name === page.request.routeName && object(route.params) && route.params.id === page.value.id);
        if (matches.length !== 1) {
          if (matches.length > 1) this.retire(page);
          else if (page.binding) { page.logicalGone = true; if (!page.nativeClosed) this.retire(page); else this.finish(page); }
          continue;
        }
        const route = matches[0], real = this.select(frame, route.key);
        if (!real || !object(real.route.params) || real.route.params.id !== page.value.id || page.binding && route.key !== page.binding.routeKey) { this.retire(page); continue; }
        const binding = page.binding ?? Object.freeze({ identity: Object.freeze({}), navigatorKey: frame.state.key, routeKey: route.key, routeName: route.name, id: page.value.id });
        page.binding = binding; page.scene = Object.freeze({ binding, route, descriptor: real, frame });
      }
      if (!this.current()) return false; this.publish(); return true;
    } catch { this.dispose(); return false; }
  }
  rootScene = () => this.current() ? this.root : null;
  /** Captured original render data only. Calling it grants no Source/native interaction or descriptor membership. */
  resourceRootScene = () => this.chain.nativeCurrent(this.chain.root) ? this.root : null;
  resourceScene = (binding: AdminRootRouterBinding): AdminRootRouterScene | null => {
    if (this.root?.binding === binding) return this.resourceRootScene();
    const page = this.bound(binding); return page && this.chain.nativeCurrent(page.value.native) ? page.scene : null;
  };
  scene = (binding: AdminRootRouterBinding): AdminRootRouterScene | null => {
    if (!this.current()) return null; if (this.root?.binding === binding) return this.root;
    return this.bound(binding)?.scene ?? null;
  };
  /** Required outlet gate: a pending page never mounts an empty or invented native scene. */
  mayMount = (entry: unknown): boolean => {
    const page = [...this.nativePages.values()].find(value => value.value.native === entry);
    return page ? !!page.binding && !!page.scene && (page.settled || this.original(page)) : object(entry) && entry.kind !== 'page';
  };
  openPage(request: AdminRootRouterPageRequest): AdminRootRouterPage | null {
    if (this.issuing) return null; this.issuing = true;
    try {
      if (!request || !object(request.identity) || this.identities.has(request.identity) || !key(request.routeName) || [request.isCurrent, request.onRequestClose, request.renderSceneContainer].some(value => typeof value !== 'function') || request.sourceScaffoldAncestor !== null && !object(request.sourceScaffoldAncestor) ||
        !this.current() || !this.renderer || !this.rendererMembers.size || !this.rootSceneMembers.size || !this.frame || !this.root || !this.frame.state.routeNames.includes(request.routeName) || !isSynchronouslyTrue(request.isCurrent)) return null;
      const frame = this.frame, nativeState = frame.navigation.getState(); if (!stack(nativeState) || nativeState.key !== frame.state.key) return null;
      const id = createAdminPresentationWindowTicket(), captured = Object.freeze({ ...request }); let record!: Page;
      const opened = this.chain.open({ parent: captured.parent, identity: captured.identity, kind: 'page', presentation: captured.presentation,
        isCurrent: () => record ? this.original(record) : this.current() && isSynchronouslyTrue(captured.isCurrent), onRequestClose: captured.onRequestClose,
        renderContent: (outlet, state) => {
          if (!record?.binding || !this.renderer) throw Error('A genuine original descriptor is required before native presentation');
          return this.renderer(record.binding, outlet, state);
        },
      }); if (!opened) return null;
      let resolve!: Page['resolve']; const closed = new Promise<'closed' | 'retired'>(done => { resolve = done; });
      const value = Object.freeze({ id, sourceIdentity: captured.identity, native: opened.entry, closed });
      record = { value, request: captured, binding: null, scene: null, members: new Set(), hadScene: false, retired: false, checking: false, closing: false, nativeClosed: false, logicalGone: false, settled: false, resolve };
      this.identities.add(captured.identity); this.pages.set(value, record); this.nativePages.set(value.native, record);
      void opened.closed.then(result => this.nativeClosed(record, result)); this.publish();
      if (!this.original(record) || !this.rootSceneMembers.size || this.frame?.navigation !== frame.navigation) { this.retire(record); return null; }
      const before = frame.navigation.getState();
      if (!stack(before) || before.key !== nativeState.key || before.index !== nativeState.index || before.routes.slice(0, before.index + 1).some((route, index) => route.key !== nativeState.routes[index]?.key)) { this.retire(record); return null; }
      try { frame.navigation.dispatch({ type: 'PUSH', payload: { name: captured.routeName, params: { id } }, source: nativeState.routes[nativeState.index]?.key, target: nativeState.key }); }
      catch { this.retire(record); return null; }
      return this.original(record) ? value : null;
    } catch { return null; } finally { this.issuing = false; }
  }
  binding = (value: AdminRootRouterPage) => this.page(value)?.binding ?? null;
  container = (binding: AdminRootRouterBinding) => {
    const source = this.root?.binding === binding ? this.options : this.bound(binding)?.request;
    return source ? Object.freeze({ render: source.renderSceneContainer, sourceScaffoldAncestor: source.sourceScaffoldAncestor }) : null;
  };
  pageFor = (binding: AdminRootRouterBinding) => this.readCurrent(binding) ? this.bound(binding)?.value ?? null : null;
  nativeParent = (binding: AdminRootRouterBinding) => this.root?.binding === binding ? this.chain.root : [...this.nativePages.values()].find(page => page.binding === binding)?.value.native ?? null;
  private routePresent(binding: AdminRootRouterBinding, focused = false): boolean {
    try {
      const state = this.frame?.navigation.getState(), index = state?.routes.findIndex(route => route.key === binding.routeKey) ?? -1, route = state?.routes[index];
      return !!state && state.type === 'stack' && state.key === binding.navigatorKey && Number.isInteger(state.index) && state.index >= 0 && state.index < state.routes.length && index >= 0 && index <= state.index &&
        (!focused || index === state.index) && route?.name === binding.routeName && (binding.id === null || object(route.params) && route.params.id === binding.id);
    } catch { return false; }
  }
  readCurrent = (binding: AdminRootRouterBinding): boolean => {
    if (this.root?.binding === binding) return this.rendererMembers.size > 0 && this.current() && this.routePresent(binding); const page = this.bound(binding);
    return !!page && page.binding === binding && !page.nativeClosed && !page.logicalGone && this.original(page) && this.routePresent(binding);
  };
  /** Actual original Source lifetime only. Renderer/scene absence holds admission separately; retained resource DTOs supply no authority. */
  sourceCurrent = (binding: AdminRootRouterBinding): boolean => {
    const source = this.sourceRevision, chain = this.chain.sourceStamp();
    if (this.root?.binding === binding) {
      const original = this.root, valid = this.current() && this.routePresent(binding);
      return valid && !this.retired && this.root === original && this.root?.binding === binding && source === this.sourceRevision && chain === this.chain.sourceStamp();
    }
    const page = this.bound(binding);
    const valid = !!page && page.binding === binding && !page.nativeClosed && !page.logicalGone && this.sourceOriginal(page) && this.routePresent(binding);
    return valid && !!page && !this.retired && !page.retired && !page.settled && !page.nativeClosed && !page.logicalGone &&
      this.pages.get(page.value) === page && this.bound(binding) === page && this.chain.sourceOutcome(page.value.native) !== 'retired' && source === this.sourceRevision && chain === this.chain.sourceStamp();
  };
  /** Actual committed descriptor membership, independently of native onShow/top/focus/geometry. */
  hasScene = (binding: AdminRootRouterBinding): boolean => {
    if (this.root?.binding === binding) return this.rootSceneMembers.size > 0 && this.readCurrent(binding) && this.root?.binding === binding && this.rootSceneMembers.size > 0 && !this.retired && this.rendererMembers.size > 0;
    const page = this.bound(binding);
    return !!page && page.binding === binding && page.members.size > 0 && this.readCurrent(binding) && this.bound(binding) === page && page.members.size > 0 && !this.retired && this.rendererMembers.size > 0;
  };
  canInteract = (binding: AdminRootRouterBinding): boolean => {
    if (!this.readCurrent(binding) || !this.routePresent(binding, true)) return false;
    if (this.root?.binding === binding) return this.rootSceneMembers.size > 0 && this.chain.canInteract(this.chain.root);
    const page = this.bound(binding)!; return !page.closing && page.members.size > 0 && this.chain.canInteract(page.value.native) && this.readCurrent(binding);
  };
  requestBack = (binding: AdminRootRouterBinding, sourceRouteKey?: string, count = 1): void => {
    if (!this.canInteract(binding) || sourceRouteKey !== undefined && sourceRouteKey !== binding.routeKey || count !== 1) return;
    const callback = this.root?.binding === binding ? this.options.onRequestClose : this.bound(binding)?.request.onRequestClose;
    if (callback) { try { void Promise.resolve(callback()).catch(() => {}); } catch { /* Source Back failure never completes either close fence. */ } }
  };
  attachScene(binding: AdminRootRouterBinding): (() => void) | null {
    if (this.root?.binding === binding && this.readCurrent(binding)) { const member = {}; this.rootSceneMembers.add(member); this.publish('resource'); return () => { if (this.rootSceneMembers.delete(member)) this.publish('resource'); }; }
    const page = this.bound(binding); if (!page || page.binding !== binding || !this.readCurrent(binding)) return null;
    const member = {}; page.hadScene = true; page.members.add(member); this.publish('resource');
    return () => { if (!page.members.delete(member)) return; this.publish('resource'); queueMicrotask(() => { if (!page.members.size) this.finish(page); }); };
  }
  /** Accepted Source close may finish while the logical page is blurred; it does not manufacture native completion. */
  closePage(value: AdminRootRouterPage): Promise<'closed' | 'retired'> | null {
    const page = this.page(value); if (!page || !page.binding || !this.original(page)) return null;
    if (!page.closing) { page.closing = true; if (!this.chain.requestClose(value.native)) { this.retire(page); return value.closed; } this.publish(); }
    return value.closed;
  }
  private nativeClosed(page: Page, result: 'closed' | 'retired') {
    if (page.settled) return;
    if (result !== 'closed' || !page.closing || !page.binding || !this.original(page)) { this.retire(page); return; }
    page.nativeClosed = true; this.publish('source');
    if (page.settled || page.retired || !this.original(page)) { this.retire(page); return; }
    const frame = this.frame, binding = page.binding;
    try {
      const state = frame?.navigation.getState(), index = state?.routes.findIndex(route => route.key === binding.routeKey) ?? -1, route = state?.routes[index];
      if (!frame || !stack(state) || state.key !== binding.navigatorKey || index <= 0 || index > state.index || route?.name !== binding.routeName || !object(route.params) || route.params.id !== page.value.id || !this.original(page)) { this.retire(page); return; }
      frame.navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: binding.routeKey, target: binding.navigatorKey }); this.finish(page);
    } catch { this.retire(page); }
  }
  private finish(page: Page) { if (page.settled || !page.nativeClosed || !page.logicalGone || !page.hadScene || page.members.size) return; this.settle(page, this.original(page) ? 'closed' : 'retired'); }
  cancel(value: AdminRootRouterPage) { const page = this.page(value); if (page) this.retire(page); }
  private retire(page: Page) { if (page.settled) return; page.retired = true; this.chain.cancel(page.value.native); this.settle(page, 'retired'); }
  private settle(page: Page, result: 'closed' | 'retired') { if (page.settled) return; page.settled = true; page.resolve(result); this.pages.delete(page.value); const removed = !this.chain.getSnapshot().resources.includes(page.value.native) && this.nativePages.delete(page.value.native); this.publish(removed ? 'both' : 'source'); }
  private stopResourceObservation() { this.unsubscribeChain(); this.unsubscribeSource(); this.unsubscribeResource(); }
  dispose() {
    if (this.retired) return; this.retired = true;
    for (const page of [...this.pages.values()]) this.retire(page);
    this.chain.retire(); this.publish('source');
    // Keep immutable original render/container/native mappings until their genuine resource proofs.
    if (this.chain.getSnapshot().rootResource !== 'pending') { this.root = null; this.frame = null; this.renderer = null; this.stopResourceObservation(); }
  }
}

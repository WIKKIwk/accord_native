import { useLayoutEffect, useState, useSyncExternalStore, type ReactElement } from 'react';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { useOptionalAdminRootRouterPage, type AdminRootRouterPageContext } from './AdminRootRouterContext';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import { useAdminShellSourceWindowLayout } from './AdminShellSourceWindowLayoutContext';
import { useAdminSourceScenePlacement, useAdminSourceSceneScaffold } from './AdminSourceSceneScaffoldContext';
import { isAdminSourceSceneScaffoldOwner, type AdminSourceSceneScaffoldOwner } from './AdminSourceSceneScaffoldOwner';
import { adminItemCreateScreenBoundary } from './adminItemCreateScreenBoundary';
import { useAdminTopNoticeScaffold, type AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';

type Content<Props extends AdminItemCreateScreenAssemblyProps> = { screen: Props; render: (props: Props, scaffold: AdminTopNoticeScaffoldBinding, footerPlacement: 'screen' | 'source') => ReactElement; validate?: (props: Props) => void };
type Original = Readonly<{ root: AdminRootRouterPageContext; source: AdminSourceSceneScaffoldOwner; generation: number; screen: AdminItemCreateScreenAssemblyProps }>;
/** Original page guards stay stable through Source geometry/locale/catalog redraws. A replacement cannot retarget old native callbacks. */
class PageGuards {
  private readonly original: Original; private readonly read; private readonly command;
  private mounted = false; private retired = false; private version = 0; private readonly listeners = new Set<() => void>();
  constructor(original: Original) {
    this.original = Object.freeze({ ...original, screen: Object.freeze({ ...original.screen }) });
    this.read = createProfileSessionGuard(original.screen.isCurrent); this.command = createProfileSessionGuard(original.screen.canInteract);
  }
  matches(original: Original) { const old = this.original; return original.root.controller === old.root.controller && original.root.binding === old.root.binding && original.source === old.source && original.generation === old.generation &&
    original.screen.expectedRootBinding === old.screen.expectedRootBinding && original.screen.sourceScaffoldAncestor === old.screen.sourceScaffoldAncestor && original.screen.isCurrent === old.screen.isCurrent && original.screen.canInteract === old.screen.canInteract; }
  commit(original: Original) { if (!this.matches(original)) this.invalidate(); }
  getSnapshot = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.version++; this.listeners.forEach(listener => { try { listener(); } catch {} }); }
  private invalidate() { if (this.retired) return; this.retired = true; this.publish(); }
  attach = () => { if (this.retired) return () => {}; this.mounted = true; this.publish(); return () => { this.mounted = false; this.publish(); }; };
  current = () => {
    const { source, generation } = this.original;
    if (!this.mounted || this.retired || !source.readCurrent(generation)) return false;
    if (!this.read()) { this.invalidate(); return false; }
    return this.mounted && !this.retired && source.readCurrent(generation);
  };
  canInteract = () => this.current() && this.original.source.canInteract(this.original.generation) && this.command() && this.current();
}
function LegacyScaffold<Props extends AdminItemCreateScreenAssemblyProps>({ screen, render }: Content<Props>) {
  const scaffold = useAdminTopNoticeScaffold(screen.sourceScaffoldAncestor); return render(screen, scaffold, 'screen');
}
function Bound<Props extends AdminItemCreateScreenAssemblyProps>({ screen, render, validate, root, source, generation }: Content<Props> & Omit<Original, 'screen'>) {
  const original = { root, source, generation, screen }, [guards] = useState(() => new PageGuards(original));
  useLayoutEffect(() => { guards.commit(original); });
  useLayoutEffect(() => guards.attach(), [guards]);
  useSyncExternalStore(guards.subscribe, guards.getSnapshot, guards.getSnapshot);
  if (!guards.matches(original) || !guards.current()) return null;
  const scaffold = source.readScaffold(generation); if (!scaffold) return null;
  const bound = { ...screen, isCurrent: guards.current, canInteract: guards.canInteract };
  if (!adminItemCreateScreenBoundary(bound, { root, source })) return null; validate?.(bound);
  return render(bound, scaffold, 'source');
}
const emptySubscribe = () => () => {}, emptySnapshot = () => null;
/** Explicit actual-scene gate BEFORE any domain hook. Physical Modal/context ancestry never selects a Source Scaffold. */
export function AdminItemCreateSourceScene<Props extends AdminItemCreateScreenAssemblyProps>(props: Content<Props>) {
  const root = useOptionalAdminRootRouterPage(), source = useAdminSourceSceneScaffold(), placed = useAdminSourceScenePlacement(), window = useAdminShellSourceWindowLayout();
  const issued = isAdminSourceSceneScaffoldOwner(source), state = useSyncExternalStore(issued ? source.subscribe : emptySubscribe, issued ? source.getSnapshot : emptySnapshot, issued ? source.getSnapshot : emptySnapshot);
  if (!root && !source && !placed && window === null && props.screen.expectedRootBinding === undefined) {
    if (!adminItemCreateScreenBoundary(props.screen)) return null; props.validate?.(props.screen); return <LegacyScaffold {...props} />;
  }
  if (placed && !source) return null;
  if (!root || !issued || !source.accepts(root, props.screen.expectedRootBinding, props.screen.sourceScaffoldAncestor)) throw TypeError('Item creation requires its exact original Root scene and shared Source Scaffold');
  if (state?.phase !== 'active' || !source.readCurrent(state.generation)) return null;
  return <Bound key={state.generation} {...props} root={root} source={source} generation={state.generation} />;
}

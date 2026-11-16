import { useIsFocused, useLocalSearchParams, useNavigation, usePreventRemove, useRoute } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AdminOwnedRemoval } from './adminOwnedRemoval';
import { useAdminOwnedNavigation } from './AdminOwnedNavigationContext';
import { useAdminPageAuthority } from './useAdminPageAuthority';
import type { AdminOwnedRouteTarget } from './adminOwnedRoutes';

/** The opaque URL never supplies arguments: an original registry entry and actual native key must both be claimed. */
export function useAdminOwnedPage() {
  const context = useAdminOwnedNavigation(), navigation = useNavigation(), route = useRoute(), params = useLocalSearchParams<{ id?: string | string[] }>();
  const focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const canFocus = useCallback(() => focus.current, []), authority = useAdminPageAuthority(context.current, canFocus);
  const { current: pageCurrent, interactive: pageInteractive } = authority;
  const [binding] = useState(() => ({ id: typeof params.id === 'string' ? params.id : null, routeKey: route.key, navigatorKey: navigation.getState()?.key ?? null }));
  const bindingMatches = params.id === binding.id && route.key === binding.routeKey && navigation.getState()?.key === binding.navigatorKey;
  const registry = context.owner.registry;
  useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
  const entry = bindingMatches && context.ready() ? registry.get(binding.id) : null;
  const [claim, setClaim] = useState<{ entry: typeof entry; routeKey: string } | null>(null);
  useLayoutEffect(() => {
    if (!entry || !binding.id || !binding.navigatorKey) return;
    const cleanup = registry.mount(binding.id, binding.routeKey); if (!cleanup) return;
    // Native attachment can only be claimed during layout; genuine child readers must wait for that acknowledgment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClaim({ entry, routeKey: binding.routeKey }); return cleanup;
  }, [registry, entry, binding]);
  const removal = useMemo(() => entry && binding.id && binding.navigatorKey ? new AdminOwnedRemoval({ id: binding.id, routeKey: binding.routeKey, navigatorKey: binding.navigatorKey,
    navigation, rootRemoval: context.owner.rootRemoval, isCurrent: () => pageCurrent() && entry.isCurrent(), canInteract: () => pageCurrent() && entry.canInteract(),
    pop: (adapter, changed) => registry.pop(binding.id!, binding.routeKey, adapter, changed),
  }) : null, [entry, binding, navigation, context.owner, pageCurrent, registry]);
  const inactive = useMemo(() => Object.freeze({ active: false, generation: 0, permitRemove: false }), []);
  const noSubscribe = useCallback(() => () => {}, []), emptySnapshot = useCallback(() => inactive, [inactive]);
  const removalState = useSyncExternalStore(removal?.subscribe ?? noSubscribe, removal?.getSnapshot ?? emptySnapshot, removal?.getSnapshot ?? emptySnapshot);
  useLayoutEffect(() => { if (!removal) return; removal.activate(); return () => removal.detach(); }, [removal]);
  const current = useCallback(() => {
    const state = navigation.getState(), index = state?.routes.findIndex(item => item.key === binding.routeKey) ?? -1, native = state?.routes[index];
    const nativeMatches = state?.key === binding.navigatorKey && index > 0 && index <= state.index && native?.name === 'owned/[id]' && !!native.params && 'id' in native.params && native.params.id === binding.id;
    return nativeMatches && bindingMatches && claim?.entry === entry && claim.routeKey === binding.routeKey && pageCurrent() && !!entry?.isCurrent() &&
      !!removal && removal.getSnapshot().active && removal.getSnapshot().generation === removalState.generation;
  }, [bindingMatches, claim, entry, binding, navigation, pageCurrent, removal, removalState.generation]);
  const interactive = useCallback(() => current() && pageInteractive() && !!entry?.canInteract() && current(), [current, pageInteractive, entry]);
  const sourcePopScope = entry?.target.kind === 'user';
  usePreventRemove(!!sourcePopScope && current() && !removalState.permitRemove, ({ data, repeat }) => {
    removal?.blocked(data.action, repeat, removalState.generation);
  });
  const back = useCallback((changed = false) => { if (current() && entry?.canInteract()) removal?.pop(changed, removalState.generation); }, [current, entry, removal, removalState.generation]);
  const open = useCallback((target: AdminOwnedRouteTarget) => interactive() ? registry.open(target, { isCurrent: current, canInteract: interactive }) : Promise.resolve(false), [registry, current, interactive]);
  return { context, entry, current, interactive, back, open, registerBack: removal?.register, admitted: current(), sourcePopScope };
}

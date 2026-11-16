import { router, useIsFocused, useNavigation, useRoute, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAdminOwnedNavigation } from './AdminOwnedNavigationContext';
import { useAdminPageAuthority } from './useAdminPageAuthority';
import { useAdminUsersOwnedOpen } from './useAdminUsersOwnedOpen';

export function useAdminUsersPage() {
  const context = useAdminOwnedNavigation(), navigation = useNavigation(), route = useRoute(), focused = useIsFocused(), focus = useRef(focused), leaving = useRef(false);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const [binding] = useState(() => ({ key: route.key, navigatorKey: navigation.getState()?.key ?? null }));
  const canFocus = useCallback(() => focus.current && !leaving.current, []), authority = useAdminPageAuthority(context.current, canFocus);
  const { current: pageCurrent, interactive: pageInteractive } = authority;
  useLayoutEffect(() => { leaving.current = false; }, [authority.generation]);
  const current = useCallback(() => { const state = navigation.getState(); return pageCurrent() && context.ready() && state?.key === binding.navigatorKey &&
    state.routes.slice(0, state.index + 1).some(item => item.key === binding.key && item.name === 'users') && pageCurrent(); }, [pageCurrent, context, navigation, binding]);
  const interactive = useCallback(() => { const state = navigation.getState(); return current() && pageInteractive() && state?.routes[state.index]?.key === binding.key && current(); }, [current, pageInteractive, navigation, binding]);
  const openUser = useAdminUsersOwnedOpen(current, interactive);
  const openProfile = useCallback(() => { if (interactive()) void context.owner.registry.open({ kind: 'profile' }, { isCurrent: current, canInteract: interactive }); }, [context.owner, current, interactive]);
  const back = useCallback(() => {
    if (!interactive()) return; const state = navigation.getState(); if (!state || state.type !== 'stack' || state.key !== binding.navigatorKey || state.routes[state.index]?.key !== binding.key) return;
    leaving.current = true;
    try { if (state.index > 0) navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: binding.key, target: binding.navigatorKey }); else router.replace(`/${Platform.OS}-admin` as Href); }
    catch (error) { leaving.current = false; throw error; }
  }, [interactive, navigation, binding]);
  return { context, current, interactive, openUser, openProfile, back, admitted: current() };
}

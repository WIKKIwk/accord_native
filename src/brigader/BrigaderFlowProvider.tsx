import { router, useIsFocused, useLocalSearchParams, useNavigation, useRoute, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { useAdminShell } from '../admin/AdminShellContext';
import { useAdminPageAuthority } from '../admin/useAdminPageAuthority';
import { BrigaderFlowRoutes } from './brigaderFlowRoutes';

const Context = createContext<BrigaderFlowRoutes | null>(null);
export function BrigaderFlowProvider({ children }: { children: ReactNode }) {
  const shell = useAdminShell();
  const registry = useMemo(() => new BrigaderFlowRoutes(shell.session, shell.isCurrent, id => router.push(`/${Platform.OS}-brigader/flow/${id}` as Href)), [shell]);
  useLayoutEffect(() => { registry.start(); return () => registry.detach(); }, [registry]);
  useEffect(() => { const stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) registry.invalidate(); }); return stop; }, [registry, shell]);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function useBrigaderFlows() { const registry = useContext(Context); if (!registry) throw new Error('Original Brigader flow owner is required'); return registry; }
/** Claim this actual native stack entry before a feature reads its original arguments. */
export function useBrigaderFlowPage() {
  const registry = useBrigaderFlows(), navigation = useNavigation(), route = useRoute(), params = useLocalSearchParams<{ id?: string }>(), focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const [binding] = useState(() => ({ id: typeof params.id === 'string' ? params.id : undefined, key: route.key, navigator: navigation.getState()?.key }));
  useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
  const entry = params.id === binding.id && route.key === binding.key ? registry.get(binding.id) : null;
  useLayoutEffect(() => { if (!entry || !binding.id) return; return registry.mount(binding.id, binding.key) ?? undefined; }, [registry, entry, binding]);
  const parent = useCallback(() => {
    const state = navigation.getState();
    return !!binding.id && registry.isMounted(binding.id, binding.key) && !!entry?.isCurrent() && !!state && state.key === binding.navigator && state.routes.slice(0, state.index + 1).some(item => item.key === binding.key && item.name === 'flow/[id]' && (item.params as { id?: unknown } | undefined)?.id === binding.id);
  }, [registry, entry, navigation, binding]);
  const canInteract = useCallback(() => focus.current && parent(), [parent]);
  const authority = useAdminPageAuthority(parent, canInteract);
  const { current, interactive } = authority;
  const back = useCallback((result?: unknown) => {
    if (!current() || !binding.id || !registry.accept(binding.id, binding.key, result)) return;
    navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: binding.key, target: binding.navigator });
  }, [current, binding, registry, navigation]);
  const registerBackResult=useCallback((read:()=>unknown)=>{if(binding.id&&current())registry.registerBackResult(binding.id,binding.key,read);},[binding,current,registry]);
  return { entry, current, interactive, back,registerBackResult };
}

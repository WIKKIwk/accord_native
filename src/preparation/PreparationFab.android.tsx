import { useFocusEffect, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';

type Scope = 'home' | 'warehouse' | 'material';
type FabOptions = {
  actions: readonly RoleFabAction[]; onSelect: (id: string) => void;
  enabled: boolean; visible: boolean; openLabel: string; closeLabel: string;
};
type Entry = FabOptions & { owner: object };
type FabContext = {
  register: (scope: Scope, owner: object, options: FabOptions) => () => void;
  setDockHeight: (height: number) => void;
};
const Context = createContext<FabContext | null>(null);
const emptyActions: readonly RoleFabAction[] = [];
const noSelect = () => {};

function fabScope(pathname: string): Scope | null {
  const path = pathname.replace(/\/+$/, '');
  return path === '/android-preparation' ? 'home' : path === '/android-preparation/warehouse' ? 'warehouse'
    : path === '/android-preparation/material' ? 'material' : null;
}

/** One FAB stays above the native stack while each focused screen supplies its menu. */
export function PreparationFabProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname(), insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Partial<Record<Scope, Entry>>>({});
  const [dockHeight, updateDockHeight] = useState(80 + insets.bottom);
  const register = useCallback((scope: Scope, owner: object, options: FabOptions) => {
    setEntries(previous => ({ ...previous, [scope]: { ...options, owner } }));
    return () => setEntries(previous => {
      if (previous[scope]?.owner !== owner) return previous;
      const next = { ...previous }; delete next[scope]; return next;
    });
  }, []);
  // The Compose navigation bar initially reports only its bottom inset while it
  // measures. Keep the previous height until the full Material bar is laid out.
  const setDockHeight = useCallback((height: number) => {
    if (Number.isFinite(height) && height >= 80 + insets.bottom - 1) updateDockHeight(height);
  }, [insets.bottom]);
  const context = useMemo(() => ({ register, setDockHeight }), [register, setDockHeight]);
  const scope = fabScope(pathname), entry = scope ? entries[scope] : undefined;
  const visible = scope !== null && (entry?.visible ?? true);
  const enabled = visible && !!entry?.enabled && entry.actions.length > 0;
  return <Context.Provider value={context}><View style={styles.root}>
    {children}
    <View style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]} pointerEvents={enabled ? 'box-none' : 'none'}
      accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'}>
      <RoleFab actions={entry?.actions ?? emptyActions} onSelect={entry?.onSelect ?? noSelect} bottomOffset={dockHeight + 16}
        testIDPrefix={scope && scope !== 'home' ? `preparation-${scope}-fab` : 'preparation-fab'}
        openLabel={entry?.openLabel} closeLabel={entry?.closeLabel} resetKey={`${scope}:${enabled}`} />
    </View>
  </View></Context.Provider>;
}

export function usePreparationFab(scope: Scope | null, options: FabOptions) {
  const context = useContext(Context);
  if (!context) throw new Error('Preparation FAB provider unavailable');
  const { register, setDockHeight } = context;
  const owner = useRef({}), select = useRef(options.onSelect);
  useLayoutEffect(() => { select.current = options.onSelect; }, [options.onSelect]);
  const onSelect = useCallback((id: string) => select.current(id), []);
  const key = JSON.stringify(options.actions);
  const actions = useMemo(() => JSON.parse(key) as RoleFabAction[], [key]);
  const { enabled, visible, openLabel, closeLabel } = options;
  useFocusEffect(useCallback(() => {
    if (!scope) return;
    return register(scope, owner.current, { actions, onSelect, enabled, visible, openLabel, closeLabel });
  }, [scope, register, actions, onSelect, enabled, visible, openLabel, closeLabel]));
  return setDockHeight;
}

const styles = StyleSheet.create({ root: { flex: 1 } });

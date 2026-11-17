import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { findNodeHandle, StyleSheet, View, type ViewInstance } from 'react-native';
import { AdminRootNativeParentOwner, type AdminRootNativeParentOriginal } from './adminRootNativeParentOwner';
import type { AdminRootPresentationChain, AdminRootPresentationParent } from './adminRootPresentationChain';

const Context = createContext<AdminRootNativeParentOwner | null>(null);
/** Only outlet descendants inherit this actual ancestor marker. Its layout is never a presentation receipt. */
export function AdminRootNativeParentSlot({ children, ...original }: AdminRootNativeParentOriginal & { children: ReactNode }) {
  const [owner] = useState(() => new AdminRootNativeParentOwner(original)), marker = useRef<ViewInstance>(null);
  const state = useSyncExternalStore(original.chain.subscribe, original.chain.getSnapshot, original.chain.getSnapshot);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const matches = owner.matches(original);
  useLayoutEffect(() => { owner.commit(original); });
  useLayoutEffect(() => owner.attach(), [owner]);
  useLayoutEffect(() => {
    if (!matches) return; const view = marker.current;
    owner.capture(view, view ? findNodeHandle(view) ?? null : null);
  }, [owner, matches, state.revision]);
  return <View ref={marker} collapsable={false} nativeID={original.parent.id} pointerEvents="box-none" style={styles.slot} testID="admin-root-native-parent-slot"
    onLayout={() => { if (!matches) return; const view = marker.current; owner.capture(view, view ? findNodeHandle(view) ?? null : null); }}>
    <Context.Provider value={owner}>{children}</Context.Provider>
  </View>;
}
/** An inherited physical parent is not necessarily the caller's original Source parent. No implicit adoption. */
export function useAdminRootNativeParent(chain: AdminRootPresentationChain, expectedParent: AdminRootPresentationParent) {
  const owner = useContext(Context);
  useSyncExternalStore(owner?.subscribe ?? emptySubscribe, owner?.getSnapshot ?? emptySnapshot, owner?.getSnapshot ?? emptySnapshot);
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  return owner?.read(chain, expectedParent) ?? null;
}
const emptySubscribe = () => () => {}, emptySnapshot = () => 0;
const styles = StyleSheet.create({ slot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });

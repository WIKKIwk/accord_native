import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { captureAdminRootPresentationOptions, type AdminRootPresentationChain, type AdminRootPresentationContent, type AdminRootPresentationEntry, type AdminRootPresentationOptions, type AdminRootPresentationParent } from './adminRootPresentationChain';
import type { AdminRootPresentationRootProps } from './AdminRootPresentationTypes';
import { AdminRootNativeParentSlot } from './AdminRootNativeParentContext';

type CarrierProps = Readonly<{ chain: AdminRootPresentationChain; parent: AdminRootPresentationParent; rootIdentity?: object;
  presentation: AdminRootPresentationOptions; renderContent: AdminRootPresentationContent; onRequestClose?: () => void }>;
function Outlet({ chain, parent }: { chain: AdminRootPresentationChain; parent: AdminRootPresentationParent }) {
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  const child = chain.child(parent); if (!child || !chain.canPresent(child)) return null;
  const renderContent = chain.content(child), presentation = chain.presentation(child);
  return renderContent && presentation ? <Carrier key={child.id} chain={chain} parent={child} renderContent={renderContent} presentation={presentation} /> : null;
}
function Carrier(props: CarrierProps) {
  const { chain, parent, rootIdentity } = props;
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  const original = useMemo(() => {
    const identity = {};
    return { identity, renderContent: props.renderContent, presentation: props.presentation, onRequestClose: props.onRequestClose,
      canInteract: () => chain.hasNativeLease(parent, identity) && chain.canInteract(parent), isCurrent: () => chain.isCurrent(parent) };
  }, [chain, parent]); // eslint-disable-line react-hooks/exhaustive-deps
  const root = parent === chain.root;
  useLayoutEffect(() => chain.attachNative(parent, original.identity, rootIdentity) ?? undefined, [chain, parent, original, rootIdentity]);
  if (!chain.hasNativeLease(parent, original.identity)) return null;
  const interactive = chain.canInteract(parent), retained = !root && chain.retained(parent as AdminRootPresentationEntry);
  return <Modal {...original.presentation} visible={root || !chain.shouldRemove(parent)} allowSwipeDismissal={false}
    onShow={() => { chain.nativeShown(parent, original.identity); }}
    onDismiss={() => {
      if (root || !chain.nativeRemoved(parent as AdminRootPresentationEntry, original.identity)) chain.nativeFailed(parent, original.identity);
    }}
    onRequestClose={() => {
      if (!root) chain.nativeRequestClose(parent as AdminRootPresentationEntry, original.identity);
      else if (chain.canInteract(parent)) { try { void Promise.resolve(original.onRequestClose?.()).catch(() => {}); } catch {} }
    }}>
    <View style={styles.fill} pointerEvents={interactive ? 'auto' : 'none'} accessibilityElementsHidden={!interactive}>
      {original.renderContent(<AdminRootNativeParentSlot chain={chain} parent={parent} nativeIdentity={original.identity}><Outlet chain={chain} parent={parent} /></AdminRootNativeParentSlot>, Object.freeze({ interactive, retained, retired: chain.isRetired(parent), canInteract: original.canInteract, isCurrent: original.isCurrent }))}
    </View>
  </Modal>;
}
/** RNModal onShow is emitted by the genuine UIKit presentation completion, never by React registration. */
export function AdminRootPresentationRootCarrier(props: AdminRootPresentationRootProps) {
  if (props.chain.platform !== 'ios' || !props.chain.acceptsRootIdentity(props.rootIdentity)) throw TypeError('An original iOS Root chain is required');
  const presentation = captureAdminRootPresentationOptions(props.presentation);
  if (!presentation || typeof props.renderContent !== 'function' || typeof props.onRequestClose !== 'function') throw TypeError('Original Root content and native presentation are required');
  return <Carrier key={props.chain.root.id} chain={props.chain} parent={props.chain.root} rootIdentity={props.rootIdentity} presentation={presentation} renderContent={props.renderContent} onRequestClose={props.onRequestClose} />;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });

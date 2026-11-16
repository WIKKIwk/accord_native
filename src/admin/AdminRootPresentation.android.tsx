import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { findNodeHandle, Modal, StyleSheet, View, type ViewInstance } from 'react-native';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import { captureAdminRootPresentationOptions, type AdminRootPresentationChain, type AdminRootPresentationContent, type AdminRootPresentationEntry, type AdminRootPresentationOptions, type AdminRootPresentationParent } from './adminRootPresentationChain';
import type { AdminRootPresentationRootProps } from './AdminRootPresentationTypes';
import { useAdminPresentationWindow } from './useAdminPresentationWindow';

type Observer = Readonly<{ windowObserver: AdminPresentationWindowObserver }>;
type CarrierProps = Observer & Readonly<{ chain: AdminRootPresentationChain; parent: AdminRootPresentationParent;
  rootIdentity?: object; presentation: AdminRootPresentationOptions; renderContent: AdminRootPresentationContent; onRequestClose?: () => void }>;

function Outlet({ chain, parent, windowObserver }: Observer & { chain: AdminRootPresentationChain; parent: AdminRootPresentationParent }) {
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  const child = chain.child(parent); if (!child || !chain.canPresent(child)) return null;
  const renderContent = chain.content(child), presentation = chain.presentation(child);
  return renderContent && presentation ? <Carrier key={child.id} chain={chain} parent={child} renderContent={renderContent} presentation={presentation} windowObserver={windowObserver} /> : null;
}
function Carrier(props: CarrierProps) {
  const { chain, parent, windowObserver, rootIdentity } = props;
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  const original = useMemo(() => {
    const identity = {};
    return { identity, observer: windowObserver, renderContent: props.renderContent, presentation: props.presentation, onRequestClose: props.onRequestClose,
      ticket: createAdminPresentationWindowTicket(), canInteract: () => chain.hasNativeLease(parent, identity) && chain.canInteract(parent), isCurrent: () => chain.isCurrent(parent) };
  }, [chain, parent]); // eslint-disable-line react-hooks/exhaustive-deps
  const marker = useRef<ViewInstance>(null), root = parent === chain.root;
  useLayoutEffect(() => chain.attachNative(parent, original.identity, rootIdentity) ?? undefined, [chain, parent, original, rootIdentity]);
  const options = useMemo(() => ({ identity: original.identity, observer: original.observer, ticket: original.ticket,
    isCurrent: () => chain.hasNativeLease(parent, original.identity), isClosing: () => chain.shouldRemove(parent),
    onDetached: () => { if (!root) chain.nativeRemoved(parent as AdminRootPresentationEntry, original.identity); },
  }), [chain, parent, original, root]);
  const closing = !root && chain.shouldRemove(parent), window = useAdminPresentationWindow(options, closing);
  useLayoutEffect(() => {
    if (window.state.phase === 'armed') chain.nativeArmed(parent, original.identity);
    else if (window.state.phase === 'failed') chain.nativeFailed(parent, original.identity);
  }, [chain, parent, original, window.state.phase]);
  if (!chain.hasNativeLease(parent, original.identity)) return null;
  const interactive = chain.canInteract(parent), retained = !root && chain.retained(parent as AdminRootPresentationEntry);
  return <Modal {...original.presentation} visible={window.state.present} allowSwipeDismissal={false}
    onShow={() => { chain.nativeShown(parent, original.identity); }}
    onRequestClose={() => {
      if (!root) chain.nativeRequestClose(parent as AdminRootPresentationEntry, original.identity);
      else if (chain.canInteract(parent)) { try { void Promise.resolve(original.onRequestClose?.()).catch(() => {}); } catch {} }
    }}>
    <View style={styles.fill} pointerEvents={interactive ? 'auto' : 'none'} accessibilityElementsHidden={!interactive} importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}>
      <View ref={marker} collapsable={false} nativeID={original.ticket} pointerEvents="none" style={styles.marker}
        onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); }} />
      {original.renderContent(<Outlet chain={chain} parent={parent} windowObserver={original.observer} />, Object.freeze({ interactive, retained, retired: chain.isRetired(parent), canInteract: original.canInteract, isCurrent: original.isCurrent }))}
    </View>
  </Modal>;
}

/** Nothing is ready until this real original native window has both onShow and an observer arm ACK. */
export function AdminRootPresentationRootCarrier(props: AdminRootPresentationRootProps & Observer) {
  const { chain, windowObserver } = props;
  if (chain.platform !== 'android' || !chain.acceptsRootIdentity(props.rootIdentity) || !windowObserver || ['arm', 'waitForDetach', 'cancelPending', 'cancel'].some(key => typeof windowObserver[key as keyof AdminPresentationWindowObserver] !== 'function'))
    throw TypeError('A genuine Android window observer is required before mounting the Root carrier');
  const presentation = captureAdminRootPresentationOptions(props.presentation);
  if (!presentation || typeof props.renderContent !== 'function' || typeof props.onRequestClose !== 'function') throw TypeError('Original Root content and native presentation are required');
  return <Carrier key={chain.root.id} chain={chain} parent={chain.root} rootIdentity={props.rootIdentity} presentation={presentation} renderContent={props.renderContent} onRequestClose={props.onRequestClose} windowObserver={windowObserver} />;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, marker: { position: 'absolute', width: 1, height: 1, opacity: 0 } });

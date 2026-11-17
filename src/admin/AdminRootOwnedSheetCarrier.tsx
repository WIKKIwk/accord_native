import { useLayoutEffect, useState, useSyncExternalStore, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { captureAdminOwnedSheetConfiguration } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet';
import { AdminRootNativeParentSlot, useAdminRootNativeParent } from './AdminRootNativeParentContext';
import type { AdminRootNativeParentBinding } from './adminRootNativeParentOwner';
import type { AdminRootPresentationChain, AdminRootPresentationEntry, AdminRootPresentationParent } from './adminRootPresentationChain';

type Props = Readonly<{ chain: AdminRootPresentationChain; entry: AdminRootPresentationEntry; outlet: ReactElement }>;
function capture({ chain, entry, outlet }: Props, parent: AdminRootPresentationParent, binding: AdminRootNativeParentBinding | null) {
  const sheet = chain.sheetPresentation(entry), renderContent = chain.content(entry);
  if (!binding || binding.chain !== chain || binding.parent !== parent || !sheet || !renderContent ||
    sheet.nativeCapability.status !== 'available' || sheet.retirementCapability.status !== 'available') return null;
  const configuration = captureAdminOwnedSheetConfiguration(chain.platform, {
    presentationTicket: entry.id, parentTicket: parent.id,
    parentViewTag: binding.marker.tag, parentNativeID: binding.marker.nativeID, ...sheet.options,
  });
  return configuration ? Object.freeze({ chain, entry, parent, binding, outlet, renderContent, configuration,
    identity: Object.freeze({}), NativeView: sheet.nativeCapability.NativeView,
    canInteract: () => chain.canInteract(entry), isCurrent: () => chain.isCurrent(entry) }) : null;
}

function BoundCarrier(props: Props & Readonly<{ parent: AdminRootPresentationParent }>) {
  const { chain, entry, parent } = props, binding = useAdminRootNativeParent(chain, parent);
  // A real parent marker may arrive after this outlet. Once captured, neither a brief missing
  // parent read nor a replacement render may retarget the original mounted native portal.
  const [original, setOriginal] = useState(() => capture(props, parent, binding));
  if (!original && binding) { const captured = capture(props, parent, binding); if (captured) setOriginal(captured); }
  useLayoutEffect(() => original ? chain.attachSheet(entry, original.identity, original.binding) ?? undefined : undefined, [chain, entry, original]);
  useSyncExternalStore(chain.subscribe, chain.getSnapshot, chain.getSnapshot);
  if (!original || !chain.hasSheetResource(entry, original.identity)) return null;
  const lifecycle = chain.sheetLifecycle(entry, original.identity);
  if (!lifecycle) return null;
  const interactive = original.canInteract(), retired = chain.isRetired(entry), NativeView = original.NativeView;
  return <NativeView configuration={original.configuration} layoutRoot dismissalEnabled={interactive}
    acceptedClose={chain.sheetAcceptedClose(entry, original.identity)} style={styles.portal}
    onSheetEvent={event => { chain.receiveSheetEvent(entry, original.identity, event.nativeEvent); }}>
    <View style={[styles.fill, retired && styles.retired]} pointerEvents={interactive ? 'auto' : 'none'} accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}>
      {original.renderContent(<AdminRootNativeParentSlot chain={chain} parent={entry} nativeIdentity={original.identity}>{original.outlet}</AdminRootNativeParentSlot>,
        Object.freeze({ interactive, retained: chain.retained(entry), retired, canInteract: original.canInteract, isCurrent: original.isCurrent }))}
    </View>
  </NativeView>;
}

/** The real owned native portal, nested inside its original parent's outlet. No React event acknowledges presentation or removal. */
export function AdminRootOwnedSheetCarrier(props: Props) {
  const [original] = useState(() => props);
  useSyncExternalStore(original.chain.subscribe, original.chain.getSnapshot, original.chain.getSnapshot);
  const parent = original.chain.parent(original.entry);
  return parent ? <BoundCarrier {...original} parent={parent} /> : null;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, retired: { opacity: 0 }, portal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });

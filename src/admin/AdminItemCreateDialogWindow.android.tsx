import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemCreateDialogPresentation } from './AdminItemCreateDialogTypes';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import { useAdminPresentationWindow } from './useAdminPresentationWindow';

/** Actual Android Dialog carrier; native Compose content remains in its children.
 * Installed ReactModalHostView transparent=true clears FLAG_DIM_BEHIND, so there is one explicit Source scrim.
 */
export function AdminItemCreateDialogWindow({ presentation, observer }: { presentation: AdminItemCreateDialogPresentation; observer: AdminPresentationWindowObserver }) {
  const marker = useRef<ViewInstance>(null), { identity } = presentation, [shown, setShown] = useState(false);
  // These callbacks belong to this exact original window, never a later body/account render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => ({ identity, observer, ticket: createAdminPresentationWindowTicket(), isCurrent: presentation.isCurrent, isClosing: presentation.isClosing, onDetached: presentation.onDismissed }), [identity, observer]);
  const window = useAdminPresentationWindow(options, !presentation.visible);
  const capture = () => { if (!shown) return; const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); };
  useLayoutEffect(() => { if (shown) { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); } }, [shown, window.owner]);
  if (!window.state.present) return null;
  const request = () => { if (window.owner.checkCurrent() && isSynchronouslyTrue(presentation.canInteract) && window.owner.checkCurrent()) presentation.onDismissRequest(); };
  return <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onShow={() => { if (window.owner.checkCurrent()) setShown(true); }} onRequestClose={request}>
    <View style={[styles.root, { backgroundColor: `rgba(0,0,0,${presentation.scrimOpacity})` }]}>
      <View ref={marker} collapsable={false} nativeID={options.ticket} pointerEvents="none" accessible={false} style={styles.marker} onLayout={capture} />
      <Pressable style={StyleSheet.absoluteFill} onPress={request} accessibilityRole="button" />
      <SafeAreaView style={[styles.container, { paddingHorizontal: presentation.horizontalInset, paddingVertical: presentation.kind === 'create' ? 0 : 24 }]} pointerEvents="box-none">
        <View style={[styles.content, { maxWidth: presentation.maxWidth }]}>{presentation.children}</View>
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, container: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', flexShrink: 1 }, marker: { position: 'absolute', width: 0, height: 0 } });

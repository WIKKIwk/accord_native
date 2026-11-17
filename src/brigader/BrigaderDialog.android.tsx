import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readAdminPresentationWindowCapability, type AdminPresentationWindowObserver } from '../admin/adminPresentationWindow';
import { createAdminPresentationWindowTicket } from '../admin/adminPresentationWindowTicket';
import { useAdminPresentationWindow } from '../admin/useAdminPresentationWindow';
import { BrigaderSurfaceContent } from './BrigaderSurfaceContent';
import type { BrigaderDialogProps } from './BrigaderDialogTypes';

function Window(props: BrigaderDialogProps & { observer: AdminPresentationWindowObserver }) {
  const { colors } = useBaseTheme();
  const [shown, setShown] = useState(false), marker = useRef<ViewInstance>(null);
  // Preserve the native window's original close reader across redraws.
  const close = useRef(props.closing); useLayoutEffect(() => { close.current = props.closing; }, [props.closing]);
  const [original] = useState(() => ({ identity: props.identity, observer: props.observer, ticket: createAdminPresentationWindowTicket(), isCurrent: props.current, onDetached: props.detached, isClosing: () => close.current }));
  const shownRef = useRef(shown); useLayoutEffect(() => { shownRef.current = shown; }, [shown]);
  const window = useAdminPresentationWindow(original, props.closing), interactive = useMemo(() => () => shownRef.current && !close.current && window.owner.checkCurrent(), [window.owner]);
  const capture = () => { const tag = shown ? findNodeHandle(marker.current) : null; if (typeof tag === 'number') window.owner.markerTag(tag); };
  useLayoutEffect(capture, [shown, window.owner]);
  if (!window.state.present) return null;
  const dismiss = () => { if (props.dismissible !== false && !close.current && window.owner.checkCurrent()) props.dismiss(); };
  return <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onShow={() => { if (window.owner.checkCurrent()) setShown(true); }} onRequestClose={()=>{if((props.backDismissible??props.dismissible!==false)&&!close.current&&window.owner.checkCurrent())props.dismiss();}}>
    <View style={{ flex: 1, backgroundColor: `rgba(0,0,0,${props.scrim ?? .54})` }}><View ref={marker} collapsable={false} nativeID={original.ticket} onLayout={capture} pointerEvents="none" style={{ position: 'absolute', width: 0, height: 0 }} />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" />
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: props.fullScreen?0:props.inset ?? 40, paddingVertical: props.fullScreen?0:24 }} pointerEvents="box-none"><View style={{ width: '100%', flex:props.fullScreen?1:undefined, maxWidth: props.fullScreen?undefined:props.maxWidth ?? 560, backgroundColor: colors.surfaceContainerHigh, borderRadius: props.fullScreen?0:28, overflow: 'hidden' }}><BrigaderSurfaceContent draw={props.children} interactive={interactive} shown={shown} /></View></SafeAreaView>
    </View>
  </Modal>;
}
export function BrigaderDialog(props: BrigaderDialogProps) {
  const [observer, setObserver] = useState<AdminPresentationWindowObserver | null>(null);
  useEffect(() => { let mounted = true; void readAdminPresentationWindowCapability('android').then(value => { if (mounted && value.status === 'available') setObserver(value.observer); }); return () => { mounted = false; }; }, []);
  return observer ? <Window {...props} observer={observer} /> : null;
}

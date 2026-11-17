import { ModalBottomSheet, RNHostView, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, View, type ViewInstance } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { readAdminPresentationWindowCapability, type AdminPresentationWindowObserver } from '../admin/adminPresentationWindow';
import { createAdminPresentationWindowTicket } from '../admin/adminPresentationWindowTicket';
import { useAdminPresentationWindow } from '../admin/useAdminPresentationWindow';
import { BrigaderSurfaceContent } from './BrigaderSurfaceContent';
import type { BrigaderDialogProps } from './BrigaderDialogTypes';

function Window(props: BrigaderDialogProps & { observer: AdminPresentationWindowObserver }) {
  const sheet = useRef<ModalBottomSheetRef>(null), marker = useRef<ViewInstance>(null), closing = useRef(props.closing), hidden = useRef(false), [ack, setAck] = useState(false),[entered,setEntered]=useState(false), { colors } = useBaseTheme();
  useLayoutEffect(() => { closing.current = props.closing; }, [props.closing]);
  const [options] = useState(() => ({ identity: props.identity, observer: props.observer, ticket: createAdminPresentationWindowTicket(), isCurrent: props.current, isClosing: () => closing.current && hidden.current, onDetached: props.detached }));
  const native = useAdminPresentationWindow(options, ack), interactive = useMemo(() => () => !closing.current && native.owner.checkCurrent() && native.owner.getSnapshot().phase === 'armed', [native.owner]);
  useEffect(() => { if (!props.closing || hidden.current) return; let active = true; void sheet.current?.hide().then(() => { if (active && native.owner.checkCurrent()) { hidden.current = true; setAck(true); } }); return () => { active = false; }; }, [props.closing, native.owner]);
  useEffect(()=>{if(!props.waitForEntrance||native.state.phase!=='armed'||closing.current)return;let active=true;void sheet.current?.expand().then(()=>{if(active&&!closing.current&&native.owner.checkCurrent())setEntered(true);},()=>{});return()=>{active=false;};},[props.waitForEntrance,native.state.phase,native.owner]);
  if (!native.state.present) return null;
  return <BaseHost style={{ position: 'absolute', width: '100%' }}><ModalBottomSheet ref={sheet} skipPartiallyExpanded showDragHandle={!props.hideDragHandle} containerColor={colors.surface} scrimColor={props.scrim===undefined?undefined:`rgba(0,0,0,${props.scrim})`} sheetGesturesEnabled={props.dismissible !== false} properties={{ shouldDismissOnBackPress: props.backDismissible??props.dismissible !== false, shouldDismissOnClickOutside: props.dismissible !== false }} onDismissRequest={() => { if ((props.dismissible !== false || props.backDismissible) && !closing.current && native.owner.checkCurrent()) props.dismiss(); }}>
    <RNHostView matchContents={{ vertical: true }}><View ref={marker} collapsable={false} nativeID={options.ticket} onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') native.owner.markerTag(tag); }} style={{ width: '100%' }}>
      <BrigaderSurfaceContent draw={props.children} interactive={interactive} shown={native.state.phase === 'armed'&&(!props.waitForEntrance||entered)} />
    </View></RNHostView>
  </ModalBottomSheet></BaseHost>;
}
export function BrigaderSheet(props: BrigaderDialogProps) {
  const [observer, setObserver] = useState<AdminPresentationWindowObserver | null>(null);
  useEffect(() => { let mounted = true; void readAdminPresentationWindowCapability('android').then(value => { if (mounted && value.status === 'available') setObserver(value.observer); }); return () => { mounted = false; }; }, []);
  return observer ? <Window {...props} observer={observer} /> : null;
}

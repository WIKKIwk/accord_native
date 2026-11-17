import { useLayoutEffect, useState } from 'react';
import { useBaseTheme } from '../components/useBaseTheme';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { BrigaderSurfaceAuthority, type BrigaderDialogProps } from './BrigaderDialogTypes';
import { BrigaderSurfaceContent } from './BrigaderSurfaceContent';
export function BrigaderDialog(props: BrigaderDialogProps) {
  const { colors } = useBaseTheme();
  const [shown, setShown] = useState(false), [authority] = useState(() => new BrigaderSurfaceAuthority(props));
  useLayoutEffect(() => { authority.update(props.closing); }, [authority, props.closing]);
  const appeared = () => { authority.appeared(); if (authority.current()) setShown(true); };
  return <Modal transparent visible={!props.closing} animationType="fade" presentationStyle="overFullScreen" onShow={appeared} onDismiss={authority.detached} onRequestClose={() => { if ((props.backDismissible??props.dismissible !== false) && authority.dismissible()) props.dismiss(); }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: props.fullScreen?0:props.inset ?? 24, paddingVertical: props.fullScreen?0:24, backgroundColor: `rgba(0,0,0,${props.scrim ?? .32})` }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (props.dismissible !== false && authority.dismissible()) props.dismiss(); }} accessibilityRole="button" /><View style={{ width: '100%', flex:props.fullScreen?1:undefined, maxWidth: props.fullScreen?undefined:props.maxWidth ?? 560, backgroundColor: colors.surface, borderRadius: props.fullScreen?0:24, overflow: 'hidden' }}><BrigaderSurfaceContent draw={props.children} interactive={authority.interactive} shown={shown} /></View>
    </View>
  </Modal>;
}

import { BottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import { interactiveDismissDisabled, onAppear, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { BrigaderSurfaceAuthority, type BrigaderDialogProps } from './BrigaderDialogTypes';
import { BrigaderSurfaceContent } from './BrigaderSurfaceContent';
export function BrigaderSheet(props: BrigaderDialogProps) {
  const [shown, setShown] = useState(false), [authority] = useState(() => new BrigaderSurfaceAuthority(props));
  useLayoutEffect(() => { authority.update(props.closing); }, [authority, props.closing]);
  const appeared = () => { authority.appeared(); if (authority.current()) setShown(true); };
  return <BaseHost style={{ position: 'absolute', width: '100%' }}><BottomSheet isPresented={!props.closing} fitToContents onIsPresentedChange={value => { if (!value && props.dismissible !== false && authority.dismissible()) props.dismiss(); }} onDismiss={authority.detached}>
    <Group modifiers={[presentationDragIndicator(props.hideDragHandle?'hidden':'visible'), interactiveDismissDisabled(props.dismissible === false), onAppear(appeared)]}><RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%' }}><BrigaderSurfaceContent draw={props.children} interactive={authority.interactive} shown={shown} /></View></RNHostView></Group>
  </BottomSheet></BaseHost>;
}

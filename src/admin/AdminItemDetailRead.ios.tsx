import { Button, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, multilineTextAlignment, padding } from '@expo/ui/swift-ui/modifiers';
import { isValidElement } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminItemDetailBody } from './AdminItemDetailBody.ios';
import { AdminItemDetailTopBar } from './AdminItemDetailHeader.ios';
import { useAdminItemDetailRead } from './AdminItemDetailReadOwner';
import type { AdminItemDetailNativeHeaderRenderer, AdminItemDetailReadProps } from './AdminItemDetailReadTypes';

export function AdminItemDetailRead(props: AdminItemDetailReadProps & Readonly<{ renderNativeHeader: AdminItemDetailNativeHeaderRenderer }>) {
  if (!props.pageIdentity || typeof props.pageIdentity !== 'object' || !isValidElement(props.footer) ||
    [props.isCurrent, props.canInteract, props.onBack, props.presentations?.render, props.presentations?.onActions, props.renderNativeHeader].some(value => typeof value !== 'function')) throw TypeError('Item detail requires its original real page, visible native header and presentation providers');
  const model = useAdminItemDetailRead(props), { colors } = useBaseTheme();
  if (!model.current() || model.state.phase === 'invalidated') return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}><AdminItemDetailTopBar model={model} backLabel={props.backLabel} renderNativeHeader={props.renderNativeHeader} />
    <AdminShellBodyFrame hasFooter testID="admin-item-detail-body-frame"><View style={styles.screen}>
      {model.state.phase === 'loading' ? <View style={styles.center}><BaseHost matchContents><ProgressView /></BaseHost></View>
        : model.state.phase === 'error' ? <ScrollView style={styles.screen} contentContainerStyle={styles.errorList}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack spacing={16} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, vertical: 40 })]}>
          <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle('secondary'), multilineTextAlignment('center')]}>{model.a('detail.item_load_failed')}</Text><Button onPress={model.retry} modifiers={[buttonStyle('plain')]}><Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{model.t('retry')}</Text></Button>
        </VStack></BaseHost></ScrollView>
          : <AdminItemDetailBody model={model} />}
    </View></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>{props.presentations.render(model.context)}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, errorList: { paddingLeft: 20, paddingTop: 24, paddingRight: 20, paddingBottom: 120 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

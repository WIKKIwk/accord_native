import { Column, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import { isValidElement } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text } from './AdminTypography.android';
import { AdminItemDetailBody } from './AdminItemDetailBody.android';
import { AdminItemDetailTopBar } from './AdminItemDetailHeader.android';
import { useAdminItemDetailRead } from './AdminItemDetailReadOwner';
import type { AdminItemDetailReadProps } from './AdminItemDetailReadTypes';

/** Native read leaf only. Real Source decision/menu/notice presenters and ancestor authority remain required. */
export function AdminItemDetailRead(props: AdminItemDetailReadProps) {
  if (!props.pageIdentity || typeof props.pageIdentity !== 'object' || !isValidElement(props.footer) ||
    [props.isCurrent, props.canInteract, props.onBack, props.presentations?.render, props.presentations?.onActions].some(value => typeof value !== 'function')) throw TypeError('Item detail requires its original real page and presentation providers');
  const model = useAdminItemDetailRead(props), { colors, chromeBackground } = useAdminShellTheme(), { width } = useWindowDimensions();
  if (!model.current() || model.state.phase === 'invalidated') return null;
  return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: chromeBackground }]}>
    <AdminItemDetailTopBar model={model} backLabel={props.backLabel} />
    <AdminShellBodyFrame hasFooter testID="admin-item-detail-body-frame"><View style={styles.screen}>
      {model.state.phase === 'loading' ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View>
        : model.state.phase === 'error' ? <ScrollView style={styles.screen} contentContainerStyle={styles.errorList}><View style={styles.retryPadding}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%', maxWidth: Math.max(280, Math.min(360, width * .88)) }}><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Text color={colors.onSurfaceVariant} style={{ fontSize: 16, textAlign: 'center', lineHeight: 21.6 }}>{model.a('detail.item_load_failed')}</Text><Column modifiers={[height(16)]} />
          <TextButton onClick={model.retry} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}><Text style={{ fontSize: 14, fontWeight: '600' }}>{model.t('retry')}</Text></TextButton>
        </Column></BaseHost></View></ScrollView>
          : <AdminItemDetailBody model={model} />}
    </View></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>{props.presentations.render(model.context)}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, errorList: { paddingLeft: 20, paddingTop: 24, paddingRight: 20, paddingBottom: 120 }, retryPadding: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

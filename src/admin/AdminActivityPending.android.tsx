import { useBaseTheme } from '../components/useBaseTheme';
import { BaseHost } from '../components/BaseHost.android';
import { Column, Text as ComposeText, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize } from '@expo/ui/jetpack-compose/modifiers';
import { useSyncExternalStore } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminScreenHeader } from './AdminTopBar.android';
import type { AdminActivityPendingProps } from './adminActivityPendingTypes';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminActivityPending({ status, onRetry, navigation, footer, profileAction }: AdminActivityPendingProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), colors = useBaseTheme().colors, insets = useSafeAreaInsets();
  const retryWidth = Math.min(360, Math.max(280, useWindowDimensions().width * 0.88));
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <AdminScreenHeader title={localizedGetter('adminActivityTitle', locale)} navigation={navigation} profileAction={profileAction} />
    <AdminShellBodyFrame hasFooter={footer != null} testID="admin-activity-pending-body-frame">
    {status === 'loading' ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> : <View style={styles.error}>
      <BaseHost matchContents={{ vertical: true }} style={{ width: retryWidth }}><Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}>
        <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{localizedGetter('serverDisconnectedRetry', locale)}</ComposeText>
        <TextButton onClick={onRetry} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }}
          modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}><ComposeText style={{ typography: 'bodyMedium', fontWeight: '600' }}>{localizedGetter('retry', locale)}</ComposeText></TextButton>
      </Column></BaseHost></View>}
    </AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

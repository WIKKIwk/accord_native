import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { AdminActivityPendingProps } from './adminActivityPendingTypes';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminActivityPending({ status, onRetry, navigation, footer }: AdminActivityPendingProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), colors = useMaterialColors(), insets = useSafeAreaInsets();
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <RoleHeader title={localizedGetter('adminActivityTitle', locale)} navigation={navigation} />
    {status === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> : <View style={styles.error}>
      <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
      <Text accessibilityRole="button" onPress={onRetry} style={[styles.retry, { color: colors.primary }]}>{localizedGetter('retry', locale)}</Text></View>}
    {footer}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  retry: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600' } });

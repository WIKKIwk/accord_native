import { Button, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminActivityPendingProps } from './adminActivityPendingTypes';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminActivityPending({ status, onRetry, navigation, footer }: AdminActivityPendingProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('adminActivityTitle', locale),
    headerLeft: () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> }} />
    <View style={styles.screen}><BaseHost style={styles.content}>{status === 'loading'
      ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack>
      : <VStack spacing={16}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><Button label={localizedGetter('retry', locale)} onPress={onRetry} /></VStack>}
    </BaseHost>{footer}</View></>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 } });

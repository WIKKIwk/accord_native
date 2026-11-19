import { Button, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, controlSize, frame } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminActivityPendingProps } from './adminActivityPendingTypes';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminActivityPending({ status, onRetry, navigation, footer, profileAction }: AdminActivityPendingProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <><Stack.Screen options={{ headerShown: true, title: localizedGetter('adminActivityTitle', locale),
    headerLeft: () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} />,
    headerRight: profileAction ? () => profileAction : undefined }} />
    <View style={styles.screen}><AdminShellBodyFrame hasFooter={footer != null} testID="admin-activity-pending-body-frame"><BaseHost style={styles.content}>{status === 'loading'
      ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack>
      : <VStack spacing={16}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><Button label={localizedGetter('retry', locale)} onPress={onRetry}
        modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 54 }), accessibilityIdentifier('admin-activity-hidden-retry')]} /></VStack>}
    </BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{footer}</View></View></>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

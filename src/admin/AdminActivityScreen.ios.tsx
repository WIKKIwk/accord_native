import { Button, HStack, List, ProgressView, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, listStyle, refreshable, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { adminActivityScreenModel, type AdminActivityRow } from './adminActivityScreenModel';
import type { AdminActivityScreenProps } from './adminActivityScreenTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function ActivityRow({ row }: { row: AdminActivityRow }) {
  const { colors } = useBaseTheme();
  return <HStack spacing={14}>
    <RNHostView matchContents><View style={[styles.badge, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={row.icon} size={18} tintColor={colors.onSurface} accessibilityElementsHidden />
    </View></RNHostView>
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={[font({ size: 14.5, weight: 'semibold' }), foregroundStyle(colors.onSurface), lineLimit(2)]}>{row.title}</Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(colors.onSurfaceVariant ?? colors.onSurface), lineLimit(2)]}>
        {row.subtitle}</Text>
    </VStack><Spacer />
    {row.value != null ? <Text modifiers={[font({ size: 11.5, weight: 'medium' }),
      foregroundStyle(colors.onSurfaceVariant ?? colors.onSurface), lineLimit(1)]}>{row.value}</Text> : null}
  </HStack>;
}
/** Unconnected content; the owning shell supplies scoped state and the real confirmation. */
export function AdminActivityScreen({ snapshot, hiddenIds, navigation, footer, onRefresh, onRequestClear }: AdminActivityScreenProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const { view, rows } = adminActivityScreenModel(snapshot, hiddenIds, locale);
  return <>
    <Stack.Screen options={{ headerShown: true, title: localizedGetter('adminActivityTitle', locale),
      headerLeft: navigation ? () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> : undefined,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={localizedGetter('clearTitle', locale)}
        onPress={onRequestClear} hitSlop={8} style={styles.clear}><SymbolView name="line.3.horizontal.decrease" size={22} tintColor={PlatformColor('label')} /></Pressable> }} />
    <View style={styles.screen}><BaseHost style={styles.content}>
      {view === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        view === 'error' ? <VStack spacing={16}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
          <Button label={localizedGetter('retry', locale)} onPress={() => { void onRefresh(); }} /></VStack> :
          view === 'empty' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
            <Text>{localizedGetter('adminNoActivity', locale)}</Text></VStack> :
            <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(onRefresh)]}>
              {rows.map((row, index) => <ActivityRow key={`${row.id}:${index}`} row={row} />)}
            </List>}
    </BaseHost>{footer}</View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, clear: { width: 42, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' } });

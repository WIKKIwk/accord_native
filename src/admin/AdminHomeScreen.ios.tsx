import { ListItem } from '@expo/ui';
import { Button, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, font, frame, listStyle, refreshable, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { adminHomeActions, adminHomeShortcuts, adminHomeShowsActionIcons, adminHomeTitle, adminHomeViewState } from './adminHomeModel';
import { adminHomeSymbol } from './adminHomeSymbols';
import type { AdminHomeScreenProps } from './adminHomeTypes';
import { useAdminHome } from './useAdminHome';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminHomeScreen(props: AdminHomeScreenProps) {
  const { session, navigation, footer } = props, { state, controller } = useAdminHome(props);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), view = adminHomeViewState(session, state);
  const rows = (view === 'actions' ? adminHomeActions(session, locale) : view === 'shortcuts' ? adminHomeShortcuts(session, locale) : [])
    .filter(row => props.isRouteAvailable(row.routeName));
  const showIcons = view === 'actions' && adminHomeShowsActionIcons(session);
  return <>
    <Stack.Screen options={{ headerShown: true, title: adminHomeTitle(session, locale),
      headerLeft: navigation ? () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> : undefined }} />
    <View style={styles.screen}>
      <BaseHost style={styles.content}>
        {view === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView modifiers={[accessibilityLabel('Loading')]} /></VStack> :
          view === 'error' ? <VStack spacing={16}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
            <Button label={localizedGetter('retry', locale)} onPress={() => { void controller.reload(); }} /></VStack> :
            <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(() => controller.reload())]}>
              <Section>{rows.map(row => <ListItem key={row.routeName} onPress={() => { void controller.openAndReload(row.routeName, props.openRoute); }}
                leading={showIcons && 'materialIcon' in row && typeof row.materialIcon === 'string' ? <SymbolView name={adminHomeSymbol(row.materialIcon)} size={23}
                  tintColor={PlatformColor('secondaryLabel')} accessibilityElementsHidden /> : undefined}
                trailing={<SymbolView name="chevron.right" size={18} tintColor={PlatformColor('secondaryLabel')} accessibilityElementsHidden />}>
                <Text modifiers={[font({ textStyle: 'body', weight: view === 'shortcuts' ? 'bold' : 'medium' })]}>{row.title}</Text>
              </ListItem>)}</Section>
            </List>}
      </BaseHost>
      {footer}
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 } });

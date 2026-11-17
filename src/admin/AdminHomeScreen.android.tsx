import { Column, IconButton, RNHostView, Row, Shape, Spacer, Surface, TextButton, TopAppBar } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as ComposeText } from './AdminTypography.android';
import { adminHomeActions, adminHomeShortcuts, adminHomeShowsActionIcons, adminHomeTitle, adminHomeViewState } from './adminHomeModel';
import { adminHomeSymbol } from './adminHomeSymbols';
import type { AdminHomeScreenProps } from './adminHomeTypes';
import { useAdminHome } from './useAdminHome';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminHomeScreen(props: AdminHomeScreenProps) {
  const { session, navigation, footer } = props, { state, controller } = useAdminHome(props);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), view = adminHomeViewState(session, state);
  const { colors } = useBaseTheme(), insets = useSafeAreaInsets(), [refreshing, setRefreshing] = useState(false), mounted = useRef(true);
  const retryWidth = Math.min(360, Math.max(280, useWindowDimensions().width * 0.88));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => {
    setRefreshing(true);
    try { await controller.reload(); } finally { if (mounted.current) setRefreshing(false); }
  };
  const rows = (view === 'actions' ? adminHomeActions(session, locale) : view === 'shortcuts' ? adminHomeShortcuts(session, locale) : [])
    .filter(row => props.isRouteAvailable(row.routeName));
  const showIcons = view === 'actions' && adminHomeShowsActionIcons(session);
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-home-header-safe-area"><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
      <Column modifiers={[fillMaxWidth()]}><TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon>{navigation ? <IconButton onClick={navigation.onPress}
          modifiers={[semantics({ contentDescription: navigation.label }), testID(navigation.testID ?? 'admin-home-navigation')]}>
          <RNHostView matchContents><SymbolView name={{ android: navigation.icon === 'back' ? 'arrow_back' : 'menu' }} size={24} tintColor={colors.onSurface} /></RNHostView>
        </IconButton> : null}</TopAppBar.NavigationIcon>
        <TopAppBar.Title><ComposeText style={{ fontSize: 24, fontWeight: '800' }}>{adminHomeTitle(session, locale)}</ComposeText></TopAppBar.Title>
        <TopAppBar.Actions>{props.profileAction ? <RNHostView matchContents><View style={styles.profile}>{props.profileAction}</View></RNHostView> : null}</TopAppBar.Actions>
      </TopAppBar><Spacer modifiers={[height(3)]} /></Column>
    </BaseHost></SafeAreaView>
    {props.topNotice}<AdminShellBodyFrame hasFooter={footer != null} testID="admin-home-body-frame">
    {view === 'loading' ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> :
      view === 'error' ? <View style={styles.error}><BaseHost matchContents={{ vertical: true }} style={{ width: retryWidth, maxWidth: '100%' }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}>
          <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{localizedGetter('serverDisconnectedRetry', locale)}</ComposeText>
          <TextButton onClick={() => { void controller.reload(); }} colors={{ contentColor: colors.primary }}
            contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}>
            <ComposeText style={{ typography: 'bodyMedium', fontWeight: '600' }}>{localizedGetter('retry', locale)}</ComposeText>
          </TextButton>
        </Column>
      </BaseHost></View> :
        <ScrollView style={styles.content} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 136 }]}
          alwaysBounceVertical overScrollMode="always" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} />}>
          <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth(), padding(4, 0, 4, 0)]}>
            {rows.map((row, index) => <Surface key={row.routeName} color={colors.surfaceContainerLowest}
              tonalElevation={0} shadowElevation={view === 'shortcuts' ? 4 : 0} modifiers={[fillMaxWidth()]}
              shape={Shape.RoundedCorner({ cornerRadii: {
                topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6,
                bottomStart: index > 0 && index === rows.length - 1 ? 18 : 6,
                bottomEnd: index > 0 && index === rows.length - 1 ? 18 : 6,
              } })} onClick={() => { void controller.openAndReload(row.routeName, props.openRoute); }}>
              <Row verticalAlignment="center" modifiers={[fillMaxWidth(), view === 'shortcuts' ? padding(16, 16, 12, 16) : padding(16, 15, 16, 15)]}>
                {showIcons && 'materialIcon' in row && typeof row.materialIcon === 'string' ? <RNHostView matchContents><SymbolView name={adminHomeSymbol(row.materialIcon)} size={23}
                  tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView> : null}
                <ComposeText color={colors.onSurface} maxLines={view === 'shortcuts' ? 2 : undefined} overflow="ellipsis"
                  style={{ typography: 'titleMedium', fontSize: view === 'shortcuts' ? 18.5 : 16, fontWeight: view === 'shortcuts' ? '700' : '500' }}
                  modifiers={[weight(1), padding(showIcons ? 14 : 0, 0, view === 'shortcuts' ? 16 : 0, 0)]}>{row.title}</ComposeText>
                <RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={22} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>
              </Row>
            </Surface>)}
          </Column></BaseHost>
        </ScrollView>}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, list: { flexGrow: 1, paddingTop: 4 },
  fullWidth: { width: '100%' }, profile: { width: 58, height: 60, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 } });

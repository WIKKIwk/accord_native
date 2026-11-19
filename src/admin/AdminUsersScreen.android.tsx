import { Box, Column, FilterChip, FlowRow, RNHostView, Row, Shape, SnackbarHost,
  Spacer, Surface, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import type { OrdersListGeometry, OrdersListScrollMetrics } from '../shared/orders/OrdersList.types';
import { useAdminShellTheme } from './useAdminShellTheme';
import type { AdminUsersRow, AdminUsersScreenProps } from './AdminUsersScreenTypes';
import { useAdminUsersScreen, type AdminUsersScreenModel } from './useAdminUsersScreen';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text } from './AdminTypography.android';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const passthrough = () => true;
function Icon({ name, color, iconSize = 24 }: { name: 'person_outline' | 'expand_more' | 'expand_less' | 'check'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
function RoleFilter({ model }: { model: AdminUsersScreenModel }) {
  const { colors } = useBaseTheme(), chipColors = { containerColor: colors.surfaceContainerLowest, labelColor: colors.onSurface,
    selectedContainerColor: colors.secondaryContainer, selectedLabelColor: colors.onSecondaryContainer };
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}>
    <FilterChip selected={model.state.selectedKind !== null} onClick={model.toggleRoles} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }}
      modifiers={[testID('admin-users-role-filter-chip')]}>
      <FilterChip.LeadingIcon><Icon name="person_outline" color={colors.onSurfaceVariant} iconSize={18} /></FilterChip.LeadingIcon>
      <FilterChip.Label><Text style={{ typography: 'labelLarge', fontWeight: '500' }}>{model.roleLabel}</Text></FilterChip.Label>
      <FilterChip.TrailingIcon><Icon name={model.state.roleMenuOpen ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} iconSize={18} /></FilterChip.TrailingIcon>
    </FilterChip>
    {model.state.roleMenuOpen ? <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
      {model.roleOptions.map(option => <FilterChip key={option.kind} selected={option.selected} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }}
        onClick={() => model.selectRole(option.kind)} modifiers={[testID(`admin-users-role-option-chip-${option.kind}`)]}>
        {option.selected ? <FilterChip.LeadingIcon><Icon name="check" color={colors.onSecondaryContainer} iconSize={18} /></FilterChip.LeadingIcon> : null}
        <FilterChip.Label><Text style={{ typography: 'labelLarge', fontWeight: '500' }}>{option.label}</Text></FilterChip.Label>
      </FilterChip>)}
    </FlowRow> : null}
  </Column></BaseHost>;
}
function UserRow({ item, model }: { item: AdminUsersRow; model: AdminUsersScreenModel }) {
  const { colors } = useBaseTheme(), factor = useSharedValue(item.entering ? 0 : 1);
  const [revisionReady, setRevisionReady] = useState(false);
  useEffect(() => { const request = requestAnimationFrame(() => setRevisionReady(true)); return () => cancelAnimationFrame(request); }, []);
  useEffect(() => { factor.value = withTiming(item.exiting ? 0 : 1, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [factor, item.exiting, item.key]);
  const motion = useAnimatedStyle(() => ({ height: (item.index > 0 ? 63 : 61) * factor.value, opacity: factor.value }));
  return <Animated.View style={[styles.rowClip, motion]} pointerEvents={item.exiting ? 'none' : 'auto'}>
    <Animated.View key={item.revision} entering={revisionReady ? FadeIn.duration(180) : undefined} exiting={FadeOut.duration(180)} style={{ paddingTop: item.index > 0 ? 2 : 0 }}>
      <WorkerQueueCard first={item.index === 0} last={item.index > 0 && item.index === item.count - 1}
        backgroundColor={colors.surfaceContainerLowest} disabled={item.exiting} testID={`admin-user-${item.id}`}
        style={styles.card} containerStyle={styles.cardInset} onPress={() => { void model.openUser(item.id); }}>
      <BaseHost style={styles.row}>
        <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(14, 8, 10, 8)]}>
          <Surface color={colors.secondaryContainer} shape={shape(8)} modifiers={[size(30, 30)]}>
            <Box contentAlignment="center" modifiers={[fillMaxSize()]}><Icon name="person_outline" color={colors.onSecondaryContainer} iconSize={16} /></Box>
          </Surface><Spacer modifiers={[size(14, 1)]} />
          <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
            <Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '700' }}>{item.title}</Text>
            <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 12.6 }}>{item.subtitle}</Text>
          </Column>
        </Row>
      </BaseHost></WorkerQueueCard>
    </Animated.View>
  </Animated.View>;
}
// @v2 AdminSuppliersScreen, AdminCatalogSearchField and AdminSupplierListRow (current 052 role choices).
export function AdminUsersScreen(props: AdminUsersScreenProps) {
  const model = useAdminUsersScreen(props), { state } = model, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets(), window = useWindowDimensions();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null), offset = useRef(0);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const reset = useMemo(() => ({ identity: model.identity, serial: state.scrollResetSerial }), [model.identity, state.scrollResetSerial]);
  useEffect(() => { offset.current = 0; }, [reset]);
  useEffect(() => {
    if (state.notice && shown.current !== state.notice.serial && model.current()) {
      shown.current = state.notice.serial; void snackbar.current?.showSnackbar({ message: model.a(state.notice.key), duration: 'short' });
    }
  }, [state.notice, model]);
  if (!model.current()) return null;
  const measure = ({ viewportHeight, contentHeight }: OrdersListGeometry) => model.scrollMetrics(viewportHeight, contentHeight - offset.current - viewportHeight);
  const scrolled = (metrics: OrdersListScrollMetrics) => { offset.current = metrics.offset; measure(metrics); };
  const contentVisible = state.screen === 'content';
  return <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-users-header-safe-area">
      <OrdersHeader search={model.searchText} searchPlaceholder={model.a('users.search')} hasSearchText={model.hasSearchText}
        testID="admin-users" controlLabels={{ back: props.backLabel, close: model.a('action.close'), clear: model.a('action.clear') }}
        onSearchChange={model.setSearch} onSearchFocus={() => model.setSearchFocused(true)} onSearchBlur={() => model.setSearchFocused(false)}
        blurOnSearchSubmit onBack={model.back} profileAction={props.profileAction} />
    </SafeAreaView>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-users-body-frame"><View style={styles.content}>
    {!model.salesManager ? <RoleFilter model={model} /> : null}
    <View style={styles.content}>
      <View style={[styles.content, !contentVisible && styles.invisible]} pointerEvents={contentVisible ? 'auto' : 'none'}
        testID="admin-users-list-visibility" accessibilityElementsHidden={!contentVisible} importantForAccessibility={contentVisible ? 'auto' : 'no-hide-descendants'}>
        <OrdersList rows={model.rows} rowKey={row => row.key} renderRow={item => <UserRow item={item} model={model} />}
          active={model.focused} passthrough={passthrough} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4}
          keyboardShouldPersistTaps="handled" scrollResetKey={reset} scrollEventThrottle={16} onScrollMetrics={scrolled} onGeometryChange={measure}
          onRefresh={model.reload} refreshing={model.refreshing} footer={<View style={styles.tail}>
            {model.showFooter && <View style={styles.pageFooter}>{state.loadingMore && <BaseHost matchContents><AdminLoadingIndicator /></BaseHost>}</View>}
          </View>}>
          {!model.rows.length && <BaseHost matchContents={{ vertical: true }} style={styles.empty}><Text style={{ typography: 'bodyLarge' }}>{model.a('users.not_found')}</Text></BaseHost>}
        </OrdersList>
      </View>
      {state.screen === 'error' ? <View style={[styles.overlay, styles.errorOverlay]}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.max(0, Math.min(window.width - 48, Math.min(360, Math.max(280, window.width * .88)))) }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', lineHeight: 21.6, textAlign: 'center' }}>{model.a('users.load_failed')}</Text>
          <WorkerSheetButton variant="text" label={model.t('retry')} onPress={model.reload} />
        </Column>
      </BaseHost></View> : state.screen !== 'content' ? <View style={styles.overlay}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(24, 16, 24, 16)]}>
          {state.screen === 'loading' ? <AdminLoadingIndicator /> : <Text style={{ typography: 'bodyLarge', textAlign: 'center' }}>{model.a('users.not_selected')}</Text>}
        </Column>
      </BaseHost></View> : null}
    </View>
    </View></AdminShellBodyFrame>
    {props.footer}
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, fullWidth: { width: '100%' },
  card: { height: 61, paddingHorizontal: 0, paddingVertical: 0 }, cardInset: { paddingHorizontal: 4, paddingTop: 0, paddingBottom: 0 },
  tail: { paddingBottom: 116 }, rowClip: { overflow: 'hidden' }, row: { width: '100%', height: 61 },
  invisible: { opacity: 0 }, overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: { justifyContent: 'flex-start', paddingHorizontal: 24, paddingVertical: 40 },
  empty: { width: '100%', paddingHorizontal: 12, paddingVertical: 12 }, pageFooter: { paddingTop: 14, alignItems: 'center', minHeight: 14 },
  notice: { position: 'absolute', left: 16, right: 16 } });

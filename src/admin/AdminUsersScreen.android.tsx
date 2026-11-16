import { Box, Column, FilterChip, FlowRow, IconButton, RNHostView, Row, Shape, SnackbarHost,
  Spacer, Surface, TextButton, useNativeState, type BasicTextFieldRef, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View, type NativeScrollEvent } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { themeController } from '../shared/themeRuntime';
import type { AdminUsersRow, AdminUsersScreenProps } from './AdminUsersScreenTypes';
import { useAdminUsersScreen, type AdminUsersScreenModel } from './useAdminUsersScreen';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text } from './AdminTypography.android';
import { AdminBasicTextField as BasicTextField } from './AdminTextFields.android';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const searchFill = (outline: string, surface: string) => `#${[1, 3, 5].map(offset => Math.round(parseInt(outline.slice(offset, offset + 2), 16) * .08 +
  parseInt(surface.slice(offset, offset + 2), 16) * .92).toString(16).padStart(2, '0')).join('')}FF`;
function Icon({ name, color, iconSize = 24 }: { name: 'arrow_back' | 'close' | 'person_outline' | 'expand_more' | 'expand_less' | 'check'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
function HeaderSlot({ visible, slotWidth, children }: { visible: boolean; slotWidth: number; children: ReactNode }) {
  const width = useSharedValue(visible ? slotWidth : 0), alpha = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    width.value = withTiming(visible ? slotWidth : 0, { duration: 180, easing: Easing.out(Easing.cubic) });
    alpha.value = withTiming(visible ? 1 : 0, { duration: 120, easing: Easing.out(Easing.cubic) });
  }, [visible, slotWidth, width, alpha]);
  const motion = useAnimatedStyle(() => ({ width: width.value, opacity: alpha.value }));
  return <Animated.View style={[styles.headerSlot, motion]} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}><View style={{ width: slotWidth, height: 60, justifyContent: 'center' }}>{children}</View></Animated.View>;
}
function SearchHeader({ model, props }: { model: AdminUsersScreenModel; props: AdminUsersScreenProps }) {
  const { colors } = useBaseTheme(), field = useRef<BasicTextFieldRef>(null), text = useNativeState(model.searchText);
  useEffect(() => { void field.current?.setText(model.searchText); }, [model.searchText]);
  const close = () => { if (model.interactive()) { void field.current?.blur(); model.setSearchFocused(false); } };
  return <View style={styles.header}>
    <HeaderSlot visible={!model.searchFocused} slotWidth={44}><BaseHost matchContents><IconButton onClick={model.back} modifiers={[size(38, 48), semantics({ contentDescription: props.backLabel }), testID('admin-users-back')]}>
      <Icon name="arrow_back" color={colors.onSurfaceVariant} />
    </IconButton></BaseHost></HeaderSlot>
    <BaseHost style={styles.searchField}><Surface color={searchFill(colors.outlineVariant, colors.surfaceContainerLow)} shape={shape(999)} modifiers={[fillMaxWidth(), height(58)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(18, 0, 0, 0)]}>
        <BasicTextField ref={field} value={text} singleLine onValueChange={model.setSearch} onFocusChanged={model.setSearchFocused}
          keyboardOptions={{ imeAction: 'search', capitalization: 'none', autoCorrectEnabled: false }} keyboardActions={{ onSearch: close }}
          textStyle={{ color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '400', lineHeight: 16.8 }}
          modifiers={[weight(1), height(58), semantics({ contentDescription: model.a('users.search') }), testID('admin-users-search')]}>
          <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}>
            <BasicTextField.InnerTextField />
            <BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium', textAlign: 'center' }}
              modifiers={[fillMaxWidth()]}>{model.searchFocused ? '' : model.a('users.search')}</Text></BasicTextField.Placeholder>
          </Box></BasicTextField.DecorationBox>
        </BasicTextField>
        {model.searchFocused || model.hasSearchText ? <IconButton onClick={model.searchFocused ? close : () => { if (model.interactive()) { void field.current?.clear(); model.setSearch(''); } }}
          modifiers={[size(48, 48), semantics({ contentDescription: model.a(model.searchFocused ? 'action.close' : 'action.clear') }), testID('admin-users-search-close')]}>
          <Icon name="close" color={colors.onSurfaceVariant} />
        </IconButton> : <Spacer modifiers={[size(18, 1)]} />}
      </Row>
    </Surface></BaseHost>
    <HeaderSlot visible={!model.searchFocused} slotWidth={58}>{props.profileAction}</HeaderSlot>
  </View>;
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
      <BaseHost style={styles.row}><Surface color={colors.surfaceContainerLowest} enabled={!item.exiting} shadowElevation={themeController.variant === 'white' ? 1 : 0}
        shape={Shape.RoundedCorner({ cornerRadii: { topStart: item.index === 0 ? 18 : 6, topEnd: item.index === 0 ? 18 : 6,
          bottomStart: item.index > 0 && item.index === item.count - 1 ? 18 : 6, bottomEnd: item.index > 0 && item.index === item.count - 1 ? 18 : 6 } })}
        modifiers={[fillMaxWidth(), height(61), testID(`admin-user-${item.id}`)]} onClick={() => { void model.openUser(item.id); }}>
        <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(14, 8, 10, 8)]}>
          <Surface color={colors.secondaryContainer} shape={shape(8)} modifiers={[size(30, 30)]}>
            <Box contentAlignment="center" modifiers={[fillMaxSize()]}><Icon name="person_outline" color={colors.onSecondaryContainer} iconSize={16} /></Box>
          </Surface><Spacer modifiers={[size(14, 1)]} />
          <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
            <Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '700' }}>{item.title}</Text>
            <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 12.6 }}>{item.subtitle}</Text>
          </Column>
        </Row>
      </Surface></BaseHost>
    </Animated.View>
  </Animated.View>;
}
// @v2 AdminSuppliersScreen, AdminCatalogSearchField and AdminSupplierListRow (current 052 role choices).
export function AdminUsersScreen(props: AdminUsersScreenProps) {
  const model = useAdminUsersScreen(props), { state } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(), window = useWindowDimensions();
  const list = useRef<FlatList<AdminUsersRow>>(null), snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null);
  const metrics = useRef({ viewport: 0, content: 0, offset: 0 });
  useEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [state.scrollResetSerial, model.identity]);
  useEffect(() => {
    if (state.notice && shown.current !== state.notice.serial && model.current()) {
      shown.current = state.notice.serial; void snackbar.current?.showSnackbar({ message: model.a(state.notice.key), duration: 'short' });
    }
  }, [state.notice, model]);
  if (!model.current()) return null;
  const sendMetrics = () => model.scrollMetrics(metrics.current.viewport, metrics.current.content - metrics.current.offset - metrics.current.viewport);
  const scrolled = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
    metrics.current = { viewport: layoutMeasurement.height, content: contentSize.height, offset: contentOffset.y }; sendMetrics();
  };
  return <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-users-header-safe-area"><SearchHeader model={model} props={props} /></SafeAreaView>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-users-body-frame"><View style={styles.content}>
    {!model.salesManager ? <RoleFilter model={model} /> : null}
    <View style={styles.content}>
      <FlatList ref={list} data={model.rows} keyExtractor={row => row.key} renderItem={({ item }) => <UserRow item={item} model={model} />}
        style={[styles.content, state.screen !== 'content' ? styles.invisible : null]} pointerEvents={state.screen === 'content' ? 'auto' : 'none'}
        accessibilityElementsHidden={state.screen !== 'content'} importantForAccessibility={state.screen === 'content' ? 'auto' : 'no-hide-descendants'}
        contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" alwaysBounceVertical overScrollMode="always" scrollEventThrottle={16}
        onScroll={event => scrolled(event.nativeEvent)} onLayout={event => { metrics.current.viewport = event.nativeEvent.layout.height; sendMetrics(); }}
        onContentSizeChange={(_width, height) => { metrics.current.content = height; sendMetrics(); }}
        refreshControl={<RefreshControl refreshing={model.refreshing} onRefresh={() => { void model.reload(); }} />}
        ListEmptyComponent={<BaseHost matchContents={{ vertical: true }} style={styles.empty}><Text style={{ typography: 'bodyLarge' }}>{model.a('users.not_found')}</Text></BaseHost>}
        ListFooterComponent={model.showFooter ? <View style={styles.pageFooter}>{state.loadingMore ? <BaseHost matchContents><AdminLoadingIndicator /></BaseHost> : null}</View> : undefined} />
      {state.screen === 'error' ? <View style={[styles.overlay, styles.errorOverlay]}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.max(0, Math.min(window.width - 48, Math.min(360, Math.max(280, window.width * .88)))) }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', lineHeight: 21.6, textAlign: 'center' }}>{model.a('users.load_failed')}</Text>
          <TextButton contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} onClick={() => { void model.reload(); }}>
            <Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text>
          </TextButton>
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
  header: { height: 63, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 3 },
  headerSlot: { height: 60, overflow: 'hidden' }, searchField: { flex: 1, minWidth: 0, height: 58, transform: [{ translateY: -1 }] },
  list: { flexGrow: 1, paddingTop: 4, paddingHorizontal: 4, paddingBottom: 116 }, rowClip: { overflow: 'hidden' }, row: { width: '100%', height: 61 },
  invisible: { opacity: 0 }, overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: { justifyContent: 'flex-start', paddingHorizontal: 24, paddingVertical: 40 },
  empty: { width: '100%', paddingHorizontal: 8, paddingVertical: 12 }, pageFooter: { paddingTop: 14, alignItems: 'center', minHeight: 14 },
  notice: { position: 'absolute', left: 16, right: 16 } });

import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminTopBar } from './AdminTopBar.android';
import { Column, FlowRow, IconButton, RNHostView, Row, SnackbarHost, Spacer, Surface, TextButton, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminText as Text } from './AdminTypography.android';
import { CustomerControls, CustomerIcon, CustomerInfoChip, CustomerPrompt, roundedCustomer } from './AdminCustomerDetailNative.android';
import { CustomerSheetStack } from './AdminCustomerDetailSheets.android';
import type { AdminCustomerDetailScreenProps } from './AdminCustomerDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminCustomerDetail, type AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

const panelMotion = LinearTransition.duration(180).easing(Easing.out(Easing.cubic));
function Detail({ model, props }: { model: AdminCustomerDetailScreenModel; props: AdminCustomerDetailScreenProps }) {
  const { detail, state, mode } = model, { colors } = useBaseTheme(), rotation = useSharedValue(state.expanded ? 180 : 0);
  useEffect(() => { rotation.value = withTiming(state.expanded ? 180 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [rotation, state.expanded]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View layout={panelMotion} style={[styles.card, { backgroundColor: colors.surface }]}>
    <View style={styles.profileHeader}><View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Surface color={colors.secondaryContainer} shape={roundedCustomer(999)}>
      <Text color={colors.onSecondaryContainer} style={{ typography: 'bodySmall', fontWeight: '700' }} modifiers={[padding(12, 8, 12, 8)]}>{model.status}</Text>
    </Surface></BaseHost></View>
      <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current, canInteract: model.interactive })}</View>
      <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: 'headlineSmall', fontWeight: '800', lineHeight: 25.92 }}>{model.displayName}</Text><Spacer modifiers={[height(6)]} />
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.subtitle}</Text>
      </Column></BaseHost></View>
    </View>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Row verticalAlignment="bottom" modifiers={[fillMaxWidth(), padding(16, 2, 16, 16)]}>
      <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
        <CustomerInfoChip icon="phone" label={dartTrim(detail.phone) || model.a('profile.phone_missing')} />
        {mode.material ? <><CustomerInfoChip icon="category" label={model.a('detail.groups_count', { count: detail.assigned_item_groups.length })} /><CustomerInfoChip icon="warehouse" label={model.a('detail.warehouses_count', { count: detail.assigned_warehouses.length })} /></> :
          <CustomerInfoChip icon="shopping_bag" label={model.a('detail.items_count', { count: detail.assigned_items.length })} />}
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </FlowRow>{mode.management ? <><Spacer modifiers={[size(8, 1)]} /><IconButton onClick={model.toggle} modifiers={[size(48, 48), semantics({ contentDescription: model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open') }), testID('admin-customer-detail-admin-toggle')]}>
        <RNHostView matchContents><Animated.View style={turn}><SymbolView name={{ android: 'expand_more' }} size={24} tintColor={colors.onSurfaceVariant} /></Animated.View></RNHostView>
      </IconButton></> : null}
    </Row></BaseHost>
    {mode.management && state.expanded ? <CustomerControls key={`${model.generation}:${model.overlayGeneration}`} model={model} props={props} /> : null}
  </Animated.View>;
}
// @v2 AdminCustomerDetailScreen: the source card remains visible and usable while loading or after a read error.
export function AdminCustomerDetailScreen(props: AdminCustomerDetailScreenProps) {
  const model = useAdminCustomerDetail(props), { state } = model, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<unknown>(null);
  useEffect(() => { if (state.notice && state.notice !== shown.current && model.current()) { shown.current = state.notice; void snackbar.current?.showSnackbar({ message: model.notice!, duration: 'short' }); } }, [state.notice, model]);
  if (!model.current() || !state.valid || state.removed) return null;
  return <View style={[styles.screen, { backgroundColor: chromeBackground }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-header-safe-area"><View style={{ paddingTop: insets.top, backgroundColor: chromeBackground }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <AdminTopBar leading={<IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel }), testID('admin-customer-detail-back')]}><CustomerIcon name="arrow_back" color={colors.onSurface} /></IconButton>}
        title={<Text style={{ typography: 'titleLarge', fontSize: 24, fontWeight: '800' }}>{model.title}</Text>}
        actions={<RNHostView matchContents><View style={styles.profileAction}>{props.profileAction}</View></RNHostView>} /><Surface color={chromeBackground} modifiers={[fillMaxWidth(), height(3)]} />
    </Column></BaseHost></View></SafeAreaView>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-customer-detail-body-frame"><ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} testID="admin-customer-detail-scroll">
      <Detail model={model} props={props} />
      {model.mode.management ? <View style={styles.subordinate}>{props.renderApparatusCard(model.apparatus)}</View> : null}
      {state.loadError != null ? <View style={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(360, Math.max(280, width * .88)), maxWidth: '100%' }}><Column horizontalAlignment="center">
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
        <TextButton onClick={model.reload} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-customer-detail-retry')]}>
          <Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text>
        </TextButton>
      </Column></BaseHost></View> : null}
    </ScrollView></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
    {model.overlays.sheets.length ? <BaseHost style={styles.overlay}><CustomerSheetStack key={model.overlays.sheets[0].id} model={model} /></BaseHost> : state.prompt ? <CustomerPrompt key={`${model.generation}:${state.prompt.serial}`} model={model} /> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, content: { padding: 4, paddingBottom: 116 },
  card: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', elevation: 2, shadowColor: '#000000', shadowOpacity: .16, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  profileHeader: { height: 204 }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' }, status: { position: 'absolute', right: 14, top: 14 },
  avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 }, profileAction: { width: 58, height: 60, justifyContent: 'center' },
  subordinate: { marginTop: 12 }, retry: { marginTop: 12, alignItems: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, notice: { position: 'absolute', left: 16, right: 16 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });

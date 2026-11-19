import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminTopBar } from './AdminTopBar.android';
import { BasicAlertDialog, Box, Button, CircularProgressIndicator, Column, FlowRow, HorizontalDivider, IconButton, LoadingIndicator, OutlinedButton, RNHostView, Row,
  Shape, SnackbarHost, Spacer, Surface, TextButton, useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, verticalScroll, weight, width as nativeWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminText as Text } from './AdminTypography.android';
import { AdminBasicTextField as BasicTextField } from './AdminTextFields.android';
import { uiText } from '../shared/localization';
import type { AdminSupplierDetailScreenProps } from './AdminSupplierDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminSupplierDetail, useAdminSupplierPhoneEditor, useAdminSupplierRemoveHost, type AdminSupplierDetailScreenModel } from './useAdminSupplierDetail';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const panelMotion = LinearTransition.duration(180).easing(Easing.out(Easing.cubic));
const alpha = (color: string, opacity: string) => `${color.slice(0, 7)}${opacity}`;
function Icon({ name, color, iconSize = 24 }: { name: 'arrow_back' | 'phone' | 'inventory_2' | 'edit' | 'check' | 'content_copy' | 'refresh'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
export function NativeSupplierPhoneField({ model }: { model: AdminSupplierDetailScreenModel }) {
  const detail = model.state.detail!, native = useNativeState(dartTrim(detail.phone)), editor = useAdminSupplierPhoneEditor(model, native), { colors } = useBaseTheme(), phone = dartTrim(detail.phone);
  return <Surface color={colors.surfaceContainerHighest} shape={rounded(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
    {editor.editing ? <BasicTextField value={native} singleLine autoFocus keyboardOptions={{ keyboardType: 'phone', imeAction: 'done' }} keyboardActions={{ onDone: () => { void editor.submit(); } }}
      textStyle={{ color: colors.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '500' }}
      modifiers={[weight(1), semantics({ contentDescription: model.a('profile.phone') }), testID('admin-supplier-detail-phone-input')]}>
      <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'titleMedium' }}>{uiText('+998 90 123 45 67', model.locale)}</Text>
      </BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
    </BasicTextField> : <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{phone || model.a('profile.entered')}</Text>}
    <IconButton enabled={!model.state.savingPhone} onClick={editor.action} modifiers={[size(48, 48), testID('admin-supplier-detail-phone-action'),
      semantics({ contentDescription: model.a(editor.editing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone') })]}>
      {model.state.savingPhone ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <Icon name={editor.editing ? 'check' : 'edit'} color={colors.onSurfaceVariant} />}
    </IconButton>
  </Row></Surface>;
}
function Controls({ model }: { model: AdminSupplierDetailScreenModel }) {
  const { state } = model, detail = state.detail!, { colors } = useBaseTheme(), hasCode = !!dartTrim(detail.code);
  const action = (label: string, click: () => void, id: string, enabled = true) => <OutlinedButton onClick={click} enabled={enabled} shape={rounded(14)} colors={{ contentColor: colors.onSurface }}
    modifiers={[fillMaxWidth(), height(54), testID(id)]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{label}</Text></OutlinedButton>;
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
    <HorizontalDivider thickness={1} color={alpha(colors.outlineVariant, 'B3')} /><Spacer modifiers={[height(14)]} />
    <Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[height(14)]} />
    <Text style={{ typography: 'bodySmall' }}>{model.a('profile.phone')}</Text><Spacer modifiers={[height(6)]} /><NativeSupplierPhoneField model={model} />
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.access_code')}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={colors.surfaceContainerHighest} shape={rounded(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
      <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{hasCode ? detail.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <IconButton onClick={() => model.copy(detail.code)} modifiers={[size(48, 48), testID('admin-supplier-detail-copy-code')]}><Icon name="content_copy" color={colors.onSurfaceVariant} /></IconButton> : null}
      <IconButton enabled={!state.regenerating} onClick={model.regenerate} modifiers={[size(48, 48), testID('admin-supplier-detail-regenerate-code')]}>
        {state.regenerating ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <Icon name="refresh" color={colors.onSurfaceVariant} />}
      </IconButton>
    </Row></Surface>
    {hasCode ? <><Spacer modifiers={[height(8)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {state.seconds > 0 ? <><Spacer modifiers={[height(12)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('profile.code_wait', { seconds: state.seconds })}</Text></> : null}
    <Spacer modifiers={[height(18)]} /><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }}>{model.a('detail.assigned_items')}</Text><Spacer modifiers={[height(10)]} />
    <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{detail.assigned_items.length ? model.a('detail.assigned_items_count', { count: detail.assigned_items.length }) : model.a('detail.assigned_items_empty')}</Text>
    <Spacer modifiers={[height(12)]} /><Row modifiers={[fillMaxWidth()]}>
      <Column modifiers={[weight(1)]}>{action(model.a('detail.items_view'), model.viewItems, 'admin-supplier-detail-items-view')}</Column><Spacer modifiers={[size(12, 1)]} />
      <Column modifiers={[weight(1)]}>{action(model.a('detail.add'), model.addItem, 'admin-supplier-detail-items-add')}</Column>
    </Row><Spacer modifiers={[height(8)]} />
    {action(model.a(state.savingStatus ? 'action.saving' : detail.blocked ? 'detail.unblock' : 'detail.block'), () => model.toggleBlocked(detail), 'admin-supplier-detail-status', !state.savingStatus)}
    <Spacer modifiers={[height(8)]} />{action(model.a(state.removing ? 'detail.removing' : 'detail.remove_from_system'), model.requestRemove, 'admin-supplier-detail-remove', !state.removing)}
  </Column></BaseHost>;
}
function Chip({ label, icon }: { label: string; icon: 'phone' | 'inventory_2' }) {
  const { colors } = useBaseTheme();
  return <Surface color={alpha(colors.surfaceContainerHighest, 'B8')} shape={rounded(999)}><Row verticalAlignment="center" modifiers={[padding(10, 8, 10, 8)]}>
    <Icon name={icon} iconSize={15} color={colors.onSurfaceVariant} /><Spacer modifiers={[size(6, 1)]} /><Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', fontWeight: '600' }}>{label}</Text>
  </Row></Surface>;
}
function Detail({ model, props }: { model: AdminSupplierDetailScreenModel; props: AdminSupplierDetailScreenProps }) {
  const { state } = model, detail = state.detail!, { colors } = useBaseTheme(), rotation = useSharedValue(state.expanded ? 180 : 0);
  useEffect(() => { rotation.value = withTiming(state.expanded ? 180 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [rotation, state.expanded]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View layout={panelMotion} style={[styles.card, { backgroundColor: colors.surface }]}>
    <View style={styles.profileHeader}><View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Surface color={colors.secondaryContainer} shape={rounded(999)}>
      <Text color={colors.onSecondaryContainer} style={{ typography: 'bodySmall', fontWeight: '700' }} modifiers={[padding(12, 8, 12, 8)]}>{model.a(detail.blocked ? 'detail.blocked' : 'detail.ready')}</Text>
    </Surface></BaseHost></View>
      <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current, canInteract: model.bodyInteractive ?? model.interactive })}</View>
      <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: 'headlineSmall', fontWeight: '800', lineHeight: 25.92 }}>{model.displayName}</Text><Spacer modifiers={[height(6)]} />
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('detail.supplier_profile')}</Text>
      </Column></BaseHost></View>
    </View>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Row verticalAlignment="bottom" modifiers={[fillMaxWidth(), padding(16, 2, 16, 16)]}>
      <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
        <Chip icon="phone" label={dartTrim(detail.phone) || model.a('profile.phone_missing')} /><Chip icon="inventory_2" label={model.a('detail.items_count', { count: detail.assigned_items.length })} />
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </FlowRow>{!model.readOnly ? <><Spacer modifiers={[size(8, 1)]} /><IconButton onClick={model.toggle}
        modifiers={[size(48, 48), semantics({ contentDescription: model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open') }), testID('admin-supplier-detail-admin-toggle')]}>
        <RNHostView matchContents><Animated.View style={turn}><SymbolView name={{ android: 'expand_more' }} size={24} tintColor={colors.onSurfaceVariant} /></Animated.View></RNHostView>
      </IconButton></> : null}
    </Row></BaseHost>
    {!model.readOnly && state.expanded ? <Controls key={model.generation} model={model} /> : null}
  </Animated.View>;
}
export function SupplierRemoveConfirmation({ model }: { model: AdminSupplierDetailScreenModel }) {
  const host = useAdminSupplierRemoveHost(model), { colors } = useBaseTheme(), { width } = useWindowDimensions();
  if (!host.visible) return null;
  return <BaseHost style={styles.dialogHost}><BasicAlertDialog properties={{ usePlatformDefaultWidth: false }} onDismissRequest={() => host.choose(false)}>
    <Surface color={colors.surfaceContainerHigh} shape={rounded(28)} border={{ width: 1, color: alpha(colors.outlineVariant, 'A6') }} modifiers={[nativeWidth(Math.min(420, Math.max(0, width - 48)))]}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 24, 24, 20)]}>
        <Text style={{ typography: 'headlineSmall' }}>{model.a('detail.supplier_remove_title')}</Text><Spacer modifiers={[height(10)]} />
        <Text style={{ typography: 'bodyLarge', lineHeight: 23.2 }} color={colors.onSurfaceVariant}>{model.a('detail.supplier_remove_message')}</Text><Spacer modifiers={[height(22)]} />
        <Row modifiers={[fillMaxWidth()]}><Surface shape={rounded(20)} border={{ width: 1, color: alpha(colors.outlineVariant, 'F2') }} modifiers={[weight(1)]}>
          <Button onClick={() => host.choose(false)} shape={rounded(20)} colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }} modifiers={[fillMaxWidth(), height(56), testID('admin-supplier-detail-remove-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('action.cancel')}</Text></Button>
        </Surface><Spacer modifiers={[size(12, 1)]} /><Button onClick={() => host.choose(true)} shape={rounded(20)} colors={{ containerColor: colors.errorContainer, contentColor: colors.onErrorContainer }}
          modifiers={[weight(1), height(56), testID('admin-supplier-detail-remove-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('detail.customer_remove')}</Text></Button></Row>
      </Column>
    </Surface>
  </BasicAlertDialog></BaseHost>;
}
// @v2 AdminSupplierDetailScreen, _AdminSupplierDetailCard and _AdminSupplierPanel.
export function AdminSupplierDetailScreen(props: AdminSupplierDetailScreenProps) {
  const model = useAdminSupplierDetail(props), { state } = model, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<unknown>(null);
  useEffect(() => { if (state.notice && state.notice !== shown.current && model.current()) { shown.current = state.notice; void snackbar.current?.showSnackbar({ message: model.notice!, duration: 'short' }); } }, [state.notice, model]);
  if (!model.current() || state.phase === 'invalidated' || state.phase === 'removed') return null;
  const body = state.phase === 'loading' ? <BaseHost style={styles.body}><Box contentAlignment="center" modifiers={[fillMaxSize()]}><Box contentAlignment="center" modifiers={[size(64, 64)]}>
      <LoadingIndicator color={colors.primary} modifiers={[size(48, 48), semantics({ contentDescription: 'Loading' })]} />
    </Box></Box></BaseHost> :
      state.phase === 'error' ? <ScrollView style={styles.body} contentContainerStyle={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(360, Math.max(280, width * .88)), maxWidth: '100%' }}>
        <Column horizontalAlignment="center"><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
          <TextButton onClick={model.reload} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }}
            modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-supplier-detail-retry')]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text></TextButton></Column>
      </BaseHost></ScrollView> : <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Detail model={model} props={props} /></ScrollView>;
  return <View style={[styles.screen, { backgroundColor: chromeBackground }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-header-safe-area"><View style={{ paddingTop: insets.top, backgroundColor: chromeBackground }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <AdminTopBar leading={<IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel }), testID('admin-supplier-detail-back')]}><Icon name="arrow_back" color={colors.onSurface} /></IconButton>}
        title={<Text style={{ typography: 'titleLarge' }}>{model.a('profile.title')}</Text>}
        actions={<RNHostView matchContents>{props.profileAction}</RNHostView>} />
    </Column></BaseHost></View></SafeAreaView>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-supplier-detail-body-frame">
    {props.bodySafeAreaBottom === undefined ? body : <View testID="admin-supplier-detail-inner-safe-area" pointerEvents={props.bodySafeAreaBottom === null ? 'none' : 'auto'}
      accessibilityElementsHidden={props.bodySafeAreaBottom === null} importantForAccessibility={props.bodySafeAreaBottom === null ? 'no-hide-descendants' : 'auto'}
      accessibilityState={{ busy: props.bodySafeAreaBottom === null }} style={[styles.body, { paddingBottom: props.bodySafeAreaBottom ?? undefined, opacity: props.bodySafeAreaBottom === null ? 0 : 1 }]}>{body}</View>}
    </AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
    {state.removePrompt ? <SupplierRemoveConfirmation key={`${model.generation}:${state.removePrompt.serial}`} model={model} /> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, content: { padding: 4, paddingBottom: 116 },
  card: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', elevation: 2, shadowColor: '#000000', shadowOpacity: .16, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  profileHeader: { height: 204 }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' }, status: { position: 'absolute', right: 14, top: 14 },
  avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 },
  retry: { paddingLeft: 20, paddingTop: 4, paddingRight: 20, paddingBottom: 24, alignItems: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, notice: { position: 'absolute', left: 16, right: 16 },
  dialogHost: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });

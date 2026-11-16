import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { BasicTextField, Box, CircularProgressIndicator, Column, FilledTonalButton, FlowRow, IconButton, LoadingIndicator, RNHostView, Row, Shape,
  SnackbarHost, Spacer, Surface, Text, TextButton, TopAppBar, useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWerkaScreenProps } from './AdminWerkaScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminWerka, type AdminWerkaScreenModel } from './useAdminWerka';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const panelMotion = LinearTransition.duration(180).easing(Easing.out(Easing.cubic));
function Icon({ name, color, iconSize = 24 }: { name: 'arrow_back' | 'phone' | 'warehouse' | 'expand_more' | 'edit' | 'check' | 'content_copy' | 'refresh'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}

/** A native editing buffer follows _fill, rather than each parent countdown/busy rebuild. */
export function NativeWerkaNameField({ model }: { model: AdminWerkaScreenModel }) {
  const { state, fields } = model, native = useNativeState(fields.name), filled = useRef(state.fillVersion), [focused, setFocused] = useState(false), attached = useRef(false), { colors } = useBaseTheme();
  useLayoutEffect(() => { attached.current = true; return () => { attached.current = false; }; }, []);
  useEffect(() => { if (filled.current !== state.fillVersion && model.current()) { filled.current = state.fillVersion; native.set(fields.name); } }, [native, state.fillVersion, fields.name, model]);
  return <Surface color={colors.surfaceContainerHighest} shape={rounded(14)} border={focused ? { width: 1.4, color: colors.primary } : undefined} modifiers={[fillMaxWidth()]}>
    <BasicTextField value={native} singleLine onValueChange={value => { if (attached.current && model.interactive()) model.changeName(value); }} onFocusChanged={value => { if (attached.current && model.interactive()) setFocused(value); }}
      textStyle={{ color: colors.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '500' }}
      modifiers={[fillMaxWidth(), padding(14, 12, 14, 12), semantics({ contentDescription: model.a('profile.name') }), testID('admin-werka-detail-name-input')]}>
      <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'titleMedium' }}>{model.a('profile.name_placeholder')}</Text>
      </BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
    </BasicTextField>
  </Surface>;
}

export function NativeWerkaPhoneField({ model }: { model: AdminWerkaScreenModel }) {
  const { state, fields } = model, native = useNativeState(fields.phone), filled = useRef(state.fillVersion), [editing, setEditing] = useState<number | null>(null),
    lifetime = useRef({ active: false, serial: 0, nextEditor: 0, editor: null as number | null, saving: state.saving }), { colors } = useBaseTheme();
  useLayoutEffect(() => { const ticket = lifetime.current; ticket.active = true; ticket.serial++; return () => { ticket.active = false; ticket.editor = null; ticket.serial++; }; }, []);
  useLayoutEffect(() => { lifetime.current.saving = state.saving; }, [state.saving]);
  useEffect(() => { if (filled.current !== state.fillVersion && model.current()) { filled.current = state.fillVersion; native.set(fields.phone); } }, [native, state.fillVersion, fields.phone, model]);
  const submit = async () => {
    if (!lifetime.current.active || !model.interactive() || lifetime.current.saving || editing === null || lifetime.current.editor !== editing) return;
    const original = lifetime.current.serial;
    if (await model.save() && lifetime.current.active && original === lifetime.current.serial && lifetime.current.editor === editing && model.current()) {
      lifetime.current.editor = null; setEditing(null);
    }
  };
  const phone = dartTrim(fields.phone);
  return <Surface color={colors.surfaceContainerHighest} shape={rounded(14)} modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
      {editing !== null ? <BasicTextField value={native} singleLine autoFocus onValueChange={value => { if (lifetime.current.active && lifetime.current.editor === editing && model.interactive()) model.changePhone(value); }}
        keyboardOptions={{ keyboardType: 'phone', imeAction: 'done' }} keyboardActions={{ onDone: () => { void submit(); } }}
        textStyle={{ color: colors.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '500' }}
        modifiers={[weight(1), semantics({ contentDescription: model.a('profile.phone') }), testID('admin-werka-detail-phone-input')]}>
        <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'titleMedium' }}>{uiText('+998 90 123 45 67', localeController.locale)}</Text>
        </BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
      </BasicTextField> : <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{phone || model.a('profile.entered')}</Text>}
      <IconButton enabled={!state.saving} onClick={() => {
        if (!lifetime.current.active || !model.interactive() || lifetime.current.saving) return;
        if (editing !== null) void submit();
        else if (lifetime.current.editor === null) { const editor = ++lifetime.current.nextEditor; lifetime.current.editor = editor; setEditing(editor); }
      }} modifiers={[size(32, 32), semantics({ contentDescription: model.a(editing !== null ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone') }), testID('admin-werka-detail-phone-action')]}>
        {state.saving ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <Icon name={editing !== null ? 'check' : 'edit'} color={colors.onSurface} iconSize={20} />}
      </IconButton>
    </Row>
  </Surface>;
}

function Controls({ model }: { model: AdminWerkaScreenModel }) {
  const { state } = model, { colors } = useBaseTheme(), hasCode = !!dartTrim(state.code);
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
    <Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[height(14)]} />
    <Text style={{ typography: 'bodySmall' }}>{model.a('profile.name')}</Text><Spacer modifiers={[height(6)]} /><NativeWerkaNameField model={model} />
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.phone')}</Text><Spacer modifiers={[height(6)]} /><NativeWerkaPhoneField model={model} />
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.access_code')}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={colors.surfaceContainerHighest} shape={rounded(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
      <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{hasCode ? state.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <IconButton onClick={model.copy} modifiers={[size(48, 48), semantics({ contentDescription: model.a('profile.code_copy_hint') }), testID('admin-werka-detail-copy-code')]}>
        <Icon name="content_copy" color={colors.onSurfaceVariant} />
      </IconButton> : null}
      <IconButton enabled={!state.regenerating} onClick={model.regenerate} modifiers={[size(48, 48), testID('admin-werka-detail-regenerate-code')]}>
        {state.regenerating ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <Icon name="refresh" color={colors.onSurfaceVariant} />}
      </IconButton>
    </Row></Surface>
    {hasCode ? <><Spacer modifiers={[height(8)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {state.seconds > 0 ? <><Spacer modifiers={[height(12)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('profile.code_wait', { seconds: state.seconds })}</Text></> : null}
    <Spacer modifiers={[height(18)]} /><FilledTonalButton enabled={!state.saving} onClick={() => { void model.save(); }} shape={rounded(14)}
      modifiers={[fillMaxWidth(), height(54), testID('admin-werka-detail-save')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(state.saving ? 'profile.saving' : 'profile.save')}</Text></FilledTonalButton>
  </Column></BaseHost>;
}

function InfoChip({ label, icon }: { label: string; icon: 'phone' | 'warehouse' }) {
  const { colors } = useBaseTheme();
  return <Surface color={`${colors.surfaceContainerHighest.slice(0, 7)}B8`} shape={rounded(999)}><Row verticalAlignment="center" modifiers={[padding(10, 8, 10, 8)]}>
    <Icon name={icon} iconSize={15} color={colors.onSurfaceVariant} /><Spacer modifiers={[size(6, 1)]} />
    <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', fontWeight: '600' }}>{label}</Text>
  </Row></Surface>;
}
function Detail({ model, props }: { model: AdminWerkaScreenModel; props: AdminWerkaScreenProps }) {
  const { state } = model, { colors } = useBaseTheme(), rotation = useSharedValue(state.expanded ? 180 : 0);
  useEffect(() => { rotation.value = withTiming(state.expanded ? 180 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [rotation, state.expanded]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View layout={panelMotion} style={[styles.card, { backgroundColor: colors.surface }]}>
    <View style={styles.profileHeader}>
      <View style={styles.banner} />
      <View style={styles.status}><BaseHost matchContents><Surface color={colors.secondaryContainer} shape={rounded(999)}>
        <Text color={colors.onSecondaryContainer} style={{ typography: 'bodySmall', fontWeight: '700' }} modifiers={[padding(12, 8, 12, 8)]}>{model.a('profile.ready')}</Text>
      </Surface></BaseHost></View>
      <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: state.avatarUrl, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current, canInteract: model.interactive })}</View>
      <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: 'headlineSmall', fontWeight: '800', lineHeight: 25.92 }}>{model.displayName}</Text><Spacer modifiers={[height(6)]} />
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('profile.description')}</Text>
      </Column></BaseHost></View>
    </View>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Row verticalAlignment="bottom" modifiers={[fillMaxWidth(), padding(16, 2, 16, 16)]}>
      <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
        <InfoChip icon="phone" label={dartTrim(model.fields.phone) || model.a('profile.phone_missing')} /><InfoChip icon="warehouse" label={model.a('profile.warehouse_worker')} />
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </FlowRow><Spacer modifiers={[size(8, 1)]} />
      <IconButton onClick={model.toggle} modifiers={[size(48, 48), semantics({ contentDescription: model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open') }), testID('admin-werka-detail-admin-toggle')]}>
        <RNHostView matchContents><Animated.View style={turn}><SymbolView name={{ android: 'expand_more' }} size={24} tintColor={colors.onSurfaceVariant} /></Animated.View></RNHostView>
      </IconButton>
    </Row></BaseHost>
    {state.expanded ? <Controls key={`${model.generation}:${state.fillVersion}`} model={model} /> : null}
  </Animated.View>;
}

// @v2 AdminWerkaScreen, _AdminWerkaDetailCard and _WerkaAdminPanel.
export function AdminWerkaScreen(props: AdminWerkaScreenProps) {
  const model = useAdminWerka(props), { state } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null);
  useEffect(() => { if (state.copiedNotice !== null && state.copiedNotice !== shown.current && model.current()) {
    shown.current = state.copiedNotice; void snackbar.current?.showSnackbar({ message: model.a('profile.code_copied'), duration: 'short' });
  } }, [state.copiedNotice, model]);
  if (!model.current() || state.phase === 'invalidated') return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>
    <View style={{ paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel }), testID('admin-werka-back')]}><Icon name="arrow_back" color={colors.onSurface} /></IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ typography: 'titleLarge', fontSize: 24, fontWeight: '800' }}>{model.a('profile.title')}</Text></TopAppBar.Title>
        <TopAppBar.Actions><RNHostView matchContents><View style={styles.profileAction}>{props.profileAction}</View></RNHostView></TopAppBar.Actions>
      </TopAppBar>
      <Surface color={colors.surfaceContainerHigh} modifiers={[fillMaxWidth(), height(3)]} />
    </Column></BaseHost></View>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-werka-body-frame">
    {state.phase === 'loading' ? <BaseHost style={styles.body}><Box contentAlignment="center" modifiers={[fillMaxSize()]}><Box contentAlignment="center" modifiers={[size(64, 64)]}>
      <LoadingIndicator color={colors.primary} modifiers={[size(48, 48), semantics({ contentDescription: 'Loading' })]} />
    </Box></Box></BaseHost> :
      state.phase === 'error' ? <ScrollView style={styles.body} contentContainerStyle={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(Math.max(width * .88, 280), 360), maxWidth: '100%' }}>
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text>
          <Spacer modifiers={[height(16)]} /><TextButton onClick={model.reload} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }}
            modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-werka-retry')]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text></TextButton></Column>
      </BaseHost></ScrollView> : <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Detail model={model} props={props} /></ScrollView>}
    </AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, content: { padding: 4, paddingBottom: 116 },
  card: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', elevation: 2,
    shadowColor: '#000000', shadowOpacity: .16, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  profileHeader: { height: 204 }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' },
  status: { position: 'absolute', right: 14, top: 14 }, avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 },
  identity: { position: 'absolute', left: 124, right: 16, top: 140 }, retry: { paddingLeft: 20, paddingTop: 4, paddingRight: 20, paddingBottom: 24, alignItems: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, profileAction: { width: 58, height: 60, justifyContent: 'center' }, notice: { position: 'absolute', left: 16, right: 16 } });

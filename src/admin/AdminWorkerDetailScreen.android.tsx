import { BasicTextField, Box, CircularProgressIndicator, Column, FlowRow, IconButton, OutlinedButton, RNHostView, Row, SnackbarHost, Spacer, Surface, Text, TopAppBar,
  useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { animated, animateContentSize, defaultMinSize, fillMaxWidth, graphicsLayer, height, padding, semantics, size, testID, tween, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkerDetailScreenProps } from './AdminWorkerDetailTypes';
import { WorkerMaterialResponsibilities, WorkerWarehouseEditor } from './AdminWorkerDetailEditors.android';
import { WorkerDetailIcon, workerDetailAlpha, workerDetailCardShape, workerDetailShape, type WorkerDetailIconName } from './AdminWorkerDetailNative.android';
import { WorkerDetailOverlays } from './AdminWorkerDetailOverlays.android';
import { dartTrim } from './dartJsonString';
import { useAdminWorkerDetail, type AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';

function InfoChip({ name, label }: { name: WorkerDetailIconName; label: string }) {
  const { colors } = useBaseTheme();
  return <Surface color={workerDetailAlpha(colors.surfaceContainerHighest, .72)} shape={workerDetailShape(999)}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }} modifiers={[padding(10, 8, 10, 8)]}>
    <WorkerDetailIcon name={name} color={colors.onSurfaceVariant} iconSize={15} /><Text color={colors.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={{ typography: 'bodySmall', fontWeight: '600' }}>{label}</Text>
  </Row></Surface>;
}
function Phone({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { state, detail } = model, native = useNativeState(state.phoneDraft), filled = useRef(state.phoneFillVersion), { colors } = useBaseTheme();
  useEffect(() => { if (filled.current !== state.phoneFillVersion && model.current()) { filled.current = state.phoneFillVersion; native.set(state.phoneDraft); } }, [native, state.phoneFillVersion, state.phoneDraft, model]);
  const phone = dartTrim(detail.phone);
  return <Surface color={colors.surfaceContainerHighest} shape={workerDetailShape(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
    {state.phoneEditing ? <BasicTextField value={native} onValueChange={model.changePhone} autoFocus singleLine keyboardOptions={{ keyboardType: 'phone', imeAction: 'done' }} keyboardActions={{ onDone: model.submitPhone }}
      textStyle={{ color: colors.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '500' }} modifiers={[weight(1), testID('admin-worker-detail-phone-input'), semantics({ contentDescription: model.a('profile.phone') })]}>
      <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder><Text style={{ typography: 'titleMedium' }} color={colors.onSurfaceVariant}>{model.u('+998901234567')}</Text></BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
    </BasicTextField> : <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{phone || model.a('profile.entered')}</Text>}
    <IconButton onClick={model.phoneAction} enabled={!state.savingPhone} modifiers={[size(48, 48), testID('admin-worker-detail-phone-action'), semantics({ contentDescription: model.a(state.phoneEditing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone') })]}>
      {state.savingPhone ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <WorkerDetailIcon name={state.phoneEditing ? 'check' : 'edit'} color={colors.onSurfaceVariant} />}
    </IconButton>
  </Row></Surface>;
}
function Controls({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { colors } = useBaseTheme(), { state, detail, a } = model, hasCode = !!dartTrim(detail.code);
  return <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
    <Surface color={workerDetailAlpha(colors.outlineVariant, .7)} modifiers={[fillMaxWidth(), height(1)]} /><Spacer modifiers={[height(14)]} /><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{a('profile.admin_controls')}</Text>
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{a('profile.phone')}</Text><Spacer modifiers={[height(6)]} /><Phone model={model} />
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{a('profile.access_code')}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={colors.surfaceContainerHighest} shape={workerDetailShape(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
      <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{hasCode ? detail.code : a('profile.code_not_shown')}</Text>
      {hasCode ? <IconButton onClick={model.copy} modifiers={[size(48, 48), semantics({ contentDescription: a('profile.code_copy_hint') }), testID('admin-worker-detail-copy-code')]}><WorkerDetailIcon name="content_copy" color={colors.onSurfaceVariant} /></IconButton> : null}
      <IconButton onClick={model.regenerate} enabled={!state.regeneratingCode} modifiers={[size(48, 48), semantics({ contentDescription: a('profile.access_code') }), testID('admin-worker-detail-regenerate-code')]}>
        {state.regeneratingCode ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <WorkerDetailIcon name="refresh" color={colors.onSurfaceVariant} />}
      </IconButton>
    </Row></Surface>
    {hasCode ? <><Spacer modifiers={[height(8)]} /><Text style={{ typography: 'bodySmall' }}>{a('profile.code_copy_hint')}</Text></> : null}
    {detail.code_retry_after_sec > 0 ? <><Spacer modifiers={[height(12)]} /><Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{a('profile.code_wait', { seconds: detail.code_retry_after_sec })}</Text></> : null}
    {model.warehouseEnabled ? <><Spacer modifiers={[height(18)]} /><WorkerWarehouseEditor model={model} /></> : null}
  </Column>;
}
function Activity({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { state, a } = model, { colors } = useBaseTheme();
  if (state.profileLoading && state.profile === null) return <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}><CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /><Text>{a('detail.activity_loading')}</Text></Row>;
  if (state.profileError && state.profile === null) return <Column modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{a('detail.activity_load_failed')}</Text><Spacer modifiers={[height(8)]} />
    <OutlinedButton onClick={model.retryProfile} colors={{ contentColor: colors.onSurface }} shape={workerDetailShape(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-worker-detail-profile-retry')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{a('detail.retry')}</Text></OutlinedButton></Column>;
  const labels = model.apparatusLabels.length ? model.apparatusLabels : [a('detail.no_assignment')];
  return <Column modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{a('detail.worker_activity')}</Text><Spacer modifiers={[height(12)]} />
    {labels.map((value, index) => <Column key={`${value}:${index}`} modifiers={[fillMaxWidth()]}>
      {index ? <Column modifiers={[fillMaxWidth(), padding(0, 9.5, 0, 9.5)]}><Surface color={colors.outlineVariant} modifiers={[fillMaxWidth(), height(1)]} /></Column> : null}
      <Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{a('label.apparatus')}</Text><Spacer modifiers={[height(4)]} /><Text style={{ typography: 'bodyMedium', fontWeight: '700' }}>{dartTrim(value) ? value : a('profile.entered')}</Text>
    </Column>)}
  </Column>;
}
/** @v2 AdminWorkerDetailScreen */
export function AdminWorkerDetailScreen(props: AdminWorkerDetailScreenProps) {
  const model = useAdminWorkerDetail(props), { state, detail, a } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(), snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null);
  const noticeSerial = state.notice?.serial, notice = model.notice;
  useEffect(() => { if (model.current() && notice && noticeSerial !== shown.current) { shown.current = noticeSerial ?? null; void snackbar.current?.showSnackbar({ message: notice, duration: 'short' }); } }, [model, notice, noticeSerial]);
  if (!model.scopeCurrent()) return null;
  const action = (label: string, click: () => void, id: string) => <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><OutlinedButton onClick={click} colors={{ contentColor: colors.onSurface }} shape={workerDetailShape(14)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 54 }), testID(id)]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{label}</Text></OutlinedButton></BaseHost>;
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }]}>
    <BaseHost style={styles.header}><Column><TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
      <TopAppBar.NavigationIcon><IconButton onClick={() => { model.back(); }} modifiers={[size(48, 48), semantics({ contentDescription: props.backLabel })]}><WorkerDetailIcon name="arrow_back" color={colors.onSurfaceVariant} /></IconButton></TopAppBar.NavigationIcon>
      <TopAppBar.Title><Text style={{ fontSize: 24, fontWeight: '800' }}>{a('profile.title')}</Text></TopAppBar.Title>
      <TopAppBar.Actions><RNHostView matchContents><View style={styles.headerAction}>{props.profileAction}</View></RNHostView></TopAppBar.Actions>
    </TopAppBar><Surface color={colors.surfaceContainerHigh} modifiers={[fillMaxWidth(), height(3)]} /></Column></BaseHost>
    <View style={[styles.frame, { backgroundColor: colors.surfaceContainerLow }]}><ScrollView style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.surface} shadowElevation={2} shape={workerDetailCardShape()} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth(), animateContentSize()]}>
        <RNHostView matchContents={{ vertical: true }}><View style={styles.profileHeader}>
          <View style={[styles.lowerBanner, { backgroundColor: colors.surface }]} /><View style={styles.banner} />
          <View style={styles.status}><BaseHost matchContents><Surface color={colors.secondaryContainer} shape={workerDetailShape(999)}><Text color={colors.onSecondaryContainer} style={{ typography: 'bodySmall', fontWeight: '700' }} modifiers={[padding(12, 8, 12, 8)]}>{model.status}</Text></Surface></BaseHost></View>
          <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: detail.avatar_url, fallbackText: model.initials, displayName: model.initials, size: 92, isCurrent: model.scopeCurrent, canInteract: model.interactive })}</View>
          <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column><Text maxLines={1} overflow="ellipsis" style={{ typography: 'headlineSmall', fontWeight: '800', lineHeight: 25.92 }}>{model.displayName}</Text><Spacer modifiers={[height(6)]} />
            <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.subtitle}</Text></Column></BaseHost></View>
        </View></RNHostView>
        <Row verticalAlignment="bottom" modifiers={[fillMaxWidth(), padding(16, 2, 16, 16)]}><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
          <InfoChip name="phone" label={dartTrim(detail.phone) || a('profile.phone_missing')} /><InfoChip name="badge" label={dartTrim(detail.level) || a('detail.level_missing')} />
          {model.warehouseEnabled ? <InfoChip name="warehouse" label={a('detail.warehouses_count', { count: state.warehouses.length })} /> : null}
          {props.renderChatAction ? <RNHostView matchContents>{props.renderChatAction(model.scopeCurrent, model.interactive)}</RNHostView> : null}
        </FlowRow>{!model.readOnly ? <><Spacer modifiers={[size(8, 1)]} /><IconButton onClick={model.toggle} modifiers={[size(48, 48), testID('admin-worker-detail-admin-toggle'), semantics({ contentDescription: a(state.expanded ? 'profile.controls_close' : 'profile.controls_open') })]}>
          <Box modifiers={[graphicsLayer({ rotationZ: animated(state.expanded ? 180 : 0, tween({ durationMillis: 180, easing: 'ease' })) })]}><WorkerDetailIcon name="expand_more" color={colors.onSurfaceVariant} /></Box>
        </IconButton></> : null}</Row>
        {!model.readOnly && state.expanded ? <Controls key={`${model.generation}:${model.phoneGeneration}`} model={model} /> : null}
      </Column></Surface></BaseHost>
      {model.preparation ? <><View style={styles.gap} /><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.surface} shadowElevation={2} shape={workerDetailCardShape()} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}><WorkerMaterialResponsibilities model={model} /></Column></Surface></BaseHost></> : null}
      {!model.system ? <><View style={styles.gap} /><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.surface} shadowElevation={2} shape={workerDetailCardShape()} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth(), padding(14, 14, 14, 14)]}><Activity model={model} /></Column></Surface></BaseHost></> : null}
      {!model.readOnly && !model.system ? <><View style={styles.gap} />{action(a('detail.worker_activity'), model.openActivity, 'admin-worker-detail-activity')}</> : null}
      {state.loadError ? <><View style={styles.gap} />{action(a('detail.reload'), model.reload, 'admin-worker-detail-reload')}</> : null}
    </ScrollView></View><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View><WorkerDetailOverlays model={model} />
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, frame: { flex: 1, marginHorizontal: 6, borderRadius: 18, overflow: 'hidden' }, fullWidth: { width: '100%' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, header: { height: 63, width: '100%' }, headerAction: { width: 58, height: 60, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 4, paddingBottom: 116 }, profileHeader: { height: 204, width: '100%' }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000' }, lowerBanner: { position: 'absolute', left: 0, right: 0, top: 112, bottom: 0 },
  status: { position: 'absolute', right: 14, top: 14 }, avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 }, gap: { height: 12 }, notice: { position: 'absolute', left: 16, right: 16 } });

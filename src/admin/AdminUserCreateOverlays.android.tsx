import { AlertDialog, Box, Button, Checkbox, Column, IconButton, ModalBottomSheet, RNHostView, Row, Shape, Spacer, Surface, TextButton, useNativeState, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { clip, defaultMinSize, fillMaxWidth, height, padding, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminBasicTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import { UserCreateIcon, UserCreateSelectable, userCreateRounded } from './AdminUserCreateNative.android';
import { adminUserCreateChoiceEnabled } from './adminUserCreateModel';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import { useAdminPresentationWindow } from './useAdminPresentationWindow';
import type { AdminUserCreateScreenModel } from './useAdminUserCreate';

const alpha = (value: string, opacity: number) => `${value.slice(0, 7)}${Math.round(255 * opacity).toString(16).padStart(2, '0')}`;
type OverlayProps = { model: AdminUserCreateScreenModel; windowObserver: AdminPresentationWindowObserver };
function IssuedCode({ model, windowObserver }: OverlayProps) {
  const value = model.state.issuedCode!, { controller, current } = model, id = value.id, marker = useRef<ViewInstance>(null);
  const options = useMemo(() => ({ identity: {}, observer: windowObserver, ticket: createAdminPresentationWindowTicket(),
    isCurrent: () => current() && controller.getSnapshot().issuedCode?.id === id,
    isClosing: () => controller.getSnapshot().issuedCode?.id === id && controller.getSnapshot().issuedCode?.closing === true,
    onDetached: () => controller.completeCode(id) }), [windowObserver, controller, current, id]);
  const window = useAdminPresentationWindow(options, value.closing);
  if (!window.state.present) return null;
  return <AlertDialog onDismissRequest={() => model.dismissCode(value.id)}>
    <AlertDialog.Title><Text style={{ typography: 'headlineSmall' }}>{model.a('user.code')}</Text></AlertDialog.Title><AlertDialog.Text><Box><Column><UserCreateSelectable value={value.value} fontSize={14} fontWeight="400" /><Spacer modifiers={[height(12)]} /><Text style={{ typography: 'bodyMedium' }}>{model.a('profile.code_copy_hint')}</Text></Column>
      <RNHostView modifiers={[size(1, 1)]}><View ref={marker} collapsable={false} nativeID={options.ticket} pointerEvents="none" accessible={false} style={styles.marker} onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); }} /></RNHostView>
    </Box></AlertDialog.Text>
    <AlertDialog.DismissButton><TextButton onClick={() => model.copyIssued(value.id)} modifiers={[testID('admin-user-create-issued-copy')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.copyLabel}</Text></TextButton></AlertDialog.DismissButton>
    <AlertDialog.ConfirmButton><TextButton onClick={() => model.dismissCode(value.id)} modifiers={[testID('admin-user-create-issued-close')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('action.close')}</Text></TextButton></AlertDialog.ConfirmButton>
  </AlertDialog>;
}
function RolePicker({ model, windowObserver }: OverlayProps) {
  const { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions(), picker = model.state.picker!, { controller, current } = model, id = picker.id;
  const [sheet, setSheet] = useState<ModalBottomSheetRef | null>(null), [hidden, setHidden] = useState(false), hiding = useRef(false), hideDone = useRef(false), marker = useRef<ViewInstance>(null), query = useNativeState(picker.query);
  const sheetRef = useCallback((value: ModalBottomSheetRef | null) => { setSheet(value); }, []);
  const options = useMemo(() => ({ identity: {}, observer: windowObserver, ticket: createAdminPresentationWindowTicket(),
    isCurrent: () => current() && controller.getSnapshot().picker?.id === id,
    isClosing: () => hideDone.current && controller.getSnapshot().picker?.id === id && controller.getSnapshot().picker?.closing === true,
    onDetached: () => controller.completePicker(id) }), [windowObserver, controller, current, id]);
  const window = useAdminPresentationWindow(options, picker.closing && hidden);
  useEffect(() => {
    if (!picker.closing || hiding.current || hidden || !sheet || typeof sheet.hide !== 'function' || !window.owner.checkCurrent()) return;
    hiding.current = true;
    void (async () => {
      try {
        const pending = sheet.hide(); if (!(pending instanceof Promise)) { hiding.current = false; return; }
        await pending;
        if (window.owner.checkCurrent() && controller.getSnapshot().picker?.closing === true) { hideDone.current = true; setHidden(true); }
      } catch { hiding.current = false; /* Missing/rejected native hide never completes the source selection. */ }
    })();
  }, [picker.closing, sheet, hidden, window.owner, controller]);
  if (!window.state.present) return null;
  const radius = 32, shape = Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: 0, bottomEnd: 0 } }), color = colors.surfaceContainerLow;
  return <ModalBottomSheet ref={sheetRef} onDismissRequest={() => model.dismissPicker(picker.id)} showDragHandle={false} sheetGesturesEnabled skipPartiallyExpanded initialFullyExpanded containerColor={color} scrimColor="rgba(0,0,0,.32)"
    modifiers={[clip(Shapes.RoundedCorner({ topStart: radius, topEnd: radius, bottomStart: 0, bottomEnd: 0 }))]}><Surface color={color} shape={shape} border={{ width: 1, color: alpha(colors.outlineVariant, .24) }}>
    <RNHostView matchContents><View ref={marker} collapsable={false} nativeID={options.ticket} onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); }} style={{ maxHeight: screenHeight * .66, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Surface color={colors.outlineVariant} shape={userCreateRounded(999)} modifiers={[size(36, 4)]} /></Column><Spacer modifiers={[height(14)]} />
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>{model.a('user.role_select')}</Text>
          <IconButton onClick={() => model.dismissPicker(picker.id)} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') }), testID('admin-user-create-picker-close')]}><UserCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton></Row>
        <Spacer modifiers={[height(14)]} />
        <Surface color={colors.surfaceContainerHighest} border={{ width: 1, color: alpha(colors.outlineVariant, .56) }} shape={userCreateRounded(999)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 58 })]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(18, 0, 18, 0)]}><UserCreateIcon name="search" color={colors.onSurfaceVariant} iconSize={26} /><Spacer modifiers={[size(12, 1)]} />
            <AdminBasicTextField value={query} singleLine onValueChange={value => model.pickerSearch(picker.id, value)} textStyle={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }} modifiers={[weight(1), height(58), testID('admin-user-create-role-search')]}>
              <AdminBasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[height(58)]}><AdminBasicTextField.InnerTextField /><AdminBasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 16, fontWeight: '700' }}>{model.a('user.role_search')}</Text></AdminBasicTextField.Placeholder></Box></AdminBasicTextField.DecorationBox>
            </AdminBasicTextField>
          </Row></Surface><Spacer modifiers={[height(14)]} />
      </Column></BaseHost>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ flexShrink: 1, flexGrow: 0 }}>
        <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 2 }}>
          {model.pickerRows.length ? model.pickerRows.map((row, index) => {
            const enabled = adminUserCreateChoiceEnabled(row.choice), outer = 18, inner = 6;
            return <Surface key={row.index} color={colors.surfaceContainerHighest} enabled={enabled} onClick={enabled ? () => model.chooseRole(picker.id, row.choice) : undefined} shape={ShapeForRow(index, model.pickerRows.length, outer, inner)} modifiers={[fillMaxWidth(), testID(`admin-user-create-role-option-${row.index}`)]}>
              <Column modifiers={[fillMaxWidth(), padding(18, 16, 18, 16)]}><Text style={{ typography: 'titleLarge', fontWeight: '700' }}>{row.title}</Text><Spacer modifiers={[height(6)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.subtitle}</Text></Column>
            </Surface>;
          }) : <Column modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]} horizontalAlignment="center"><Text style={{ typography: 'bodyMedium' }} color={colors.onSurfaceVariant}>{model.t('noRecordsYet')}</Text></Column>}
        </Column></BaseHost>
      </ScrollView>
    </View></RNHostView></Surface>
  </ModalBottomSheet>;
}
function GroupBody({ model }: { model: AdminUserCreateScreenModel }) {
  const picker = model.state.picker!, { colors } = useBaseTheme();
  return <><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>{model.a('user.select_item_groups')}</Text>
      <IconButton onClick={() => model.dismissPicker(picker.id)} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') }), testID('admin-user-create-picker-close')]}><UserCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton></Row><Spacer modifiers={[height(8)]} />
  </Column></BaseHost><ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1, flexGrow: 0 }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 6 }}>
    {model.state.groups.map(group => <Surface key={group} color={colors.surfaceContainerHighest} shape={userCreateRounded(16)} onClick={() => model.toggleGroup(picker.id, group, !picker.selected.includes(group))} modifiers={[fillMaxWidth(), testID(`admin-user-create-group-${group}`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 0, 16, 0), defaultMinSize({ minHeight: 56 })]}><Checkbox value={picker.selected.includes(group)} onCheckedChange={value => model.toggleGroup(picker.id, group, value)} /><Spacer modifiers={[size(16, 1)]} /><Text modifiers={[weight(1)]}>{group}</Text></Row>
    </Surface>)}
  </Column></BaseHost></ScrollView><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}><Button enabled={picker.selected.length > 0} onClick={() => model.confirmGroups(picker.id)} shape={userCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-user-create-groups-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('action.select')}</Text></Button></Column></BaseHost></>;
}
function GroupDialog({ model, windowObserver }: OverlayProps) {
  const picker = model.state.picker!, { controller, current } = model, id = picker.id, marker = useRef<ViewInstance>(null), { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  const options = useMemo(() => ({ identity: {}, observer: windowObserver, ticket: createAdminPresentationWindowTicket(),
    isCurrent: () => current() && controller.getSnapshot().picker?.id === id,
    isClosing: () => controller.getSnapshot().picker?.id === id && controller.getSnapshot().picker?.closing === true,
    onDetached: () => controller.completePicker(id) }), [windowObserver, controller, current, id]);
  const window = useAdminPresentationWindow(options, picker.closing); if (!window.state.present) return null;
  return <Modal transparent visible animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={() => model.dismissPicker(id)}>
    <View style={styles.groupBackdrop}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={model.a('action.close')} onPress={() => model.dismissPicker(id)} />
      <View style={[styles.groupPanel, { backgroundColor: colors.surface }]}><SafeAreaView edges={['left', 'right']}>
        <View ref={marker} collapsable={false} nativeID={options.ticket} onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); }} style={{ maxHeight: screenHeight * .66, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 }}><GroupBody model={model} /></View>
      </SafeAreaView></View>
    </View>
  </Modal>;
}
const ShapeForRow = (index: number, length: number, outer: number, inner: number) => Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? outer : inner, topEnd: index === 0 ? outer : inner, bottomStart: length > 1 && index === length - 1 ? outer : inner, bottomEnd: length > 1 && index === length - 1 ? outer : inner } });
export function AdminUserCreateOverlays({ model, windowObserver }: OverlayProps) {
  if (!model.current()) return null;
  return <><BaseHost style={styles.host}>{model.state.picker?.kind === 'roles' ? <RolePicker key={model.state.picker.id} model={model} windowObserver={windowObserver} /> : null}{model.state.issuedCode ? <IssuedCode key={model.state.issuedCode.id} model={model} windowObserver={windowObserver} /> : null}</BaseHost>
    {model.state.picker?.kind === 'groups' ? <GroupDialog key={model.state.picker.id} model={model} windowObserver={windowObserver} /> : null}</>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, host: { position: 'absolute', width: '100%' }, marker: { width: 1, height: 1, opacity: 0 }, groupBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)', justifyContent: 'flex-end' }, groupPanel: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' } });

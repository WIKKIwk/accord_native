import { BasicAlertDialog, Button, CircularProgressIndicator, Column, IconButton, LazyColumn, ModalBottomSheet, OutlinedTextField, RNHostView, Row, Shape, SnackbarHost, Spacer, Surface, Text,
  useMaterialColors, useNativeState, type ModalBottomSheetRef, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, imePadding, padding, semantics, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { adminUserRoleLabel } from './adminUsersModel';
import type { AdminWarehouseCreateProps } from './AdminWarehouseCreateTypes';
import { useAdminWarehouseCreate } from './useAdminWarehouseCreate';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function Icon({ name, color, size: iconSize = 24 }: { name: 'close' | 'search' | 'person_search' | 'expand_more' | 'link'; color: string; size?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} /></RNHostView>;
}
function NameField({ label, value, change, save }: { label: string; value: string; change: (text: string) => void; save: () => void }) {
  const text = useNativeState(value), colors = useMaterialColors();
  return <OutlinedTextField value={text} onValueChange={change} singleLine shape={shape(12)} keyboardOptions={{ imeAction: 'done' }} keyboardActions={{ onDone: save }}
    colors={{ focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface }} modifiers={[fillMaxWidth(), testID('admin-warehouse-create-name')]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}
function AssigneePicker({ model }: { model: ReturnType<typeof useAdminWarehouseCreate> }) {
  const { state, controller, a, t, users } = model, picker = state.picker!, colors = useMaterialColors(), { height: screenHeight } = useWindowDimensions();
  const query = useNativeState(picker.query), sheet = useRef<ModalBottomSheetRef>(null), hiding = useRef(false);
  const hide = async (action: () => void) => {
    if (hiding.current) return;
    hiding.current = true;
    try { await sheet.current?.hide(); action(); } finally { hiding.current = false; }
  };
  return <ModalBottomSheet ref={sheet} onDismissRequest={() => controller.dismissPicker(picker.id)} skipPartiallyExpanded initialFullyExpanded showDragHandle={false}
    scrimColor="rgba(0,0,0,0.32)" containerColor={colors.surface} sheetGesturesEnabled>
    <Column modifiers={[fillMaxWidth(), height(screenHeight * .66), imePadding(), padding(12, 12, 12, 24)]}>
      <Column modifiers={[fillMaxWidth()]} horizontalAlignment="center"><Surface color={colors.outlineVariant} shape={shape(999)} modifiers={[size(36, 4)]} /></Column><Spacer modifiers={[height(14)]} />
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ fontSize: 22, fontWeight: 'bold' }} modifiers={[weight(1)]}>{a('warehouse.assign_to')}</Text>
        <IconButton onClick={() => { void hide(() => controller.dismissPicker(picker.id)); }} modifiers={[size(48, 48), semantics({ contentDescription: a('action.close') })]}><Icon name="close" color={colors.onSurface} /></IconButton>
      </Row><Spacer modifiers={[height(14)]} />
      <OutlinedTextField value={query} onValueChange={text => controller.searchPicker(picker.id, text)} singleLine shape={shape(30)}
        colors={{ focusedContainerColor: colors.surfaceContainerHighest, unfocusedContainerColor: colors.surfaceContainerHighest,
          focusedIndicatorColor: colors.surfaceContainerHighest, unfocusedIndicatorColor: colors.surfaceContainerHighest }}
        modifiers={[fillMaxWidth(), height(58), testID('admin-warehouse-assignee-search')]}>
        <OutlinedTextField.Placeholder><Text>{a('warehouse.user_search')}</Text></OutlinedTextField.Placeholder>
        <OutlinedTextField.LeadingIcon><Icon name="search" color={colors.onSurfaceVariant} size={26} /></OutlinedTextField.LeadingIcon>
      </OutlinedTextField><Spacer modifiers={[height(14)]} />
      <LazyColumn modifiers={[fillMaxWidth(), weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
        {!users.length ? <Text>{t('noRecordsYet')}</Text> : users.map((user, index) => <Surface key={`${user.kind}:${user.id}:${index}`} color={colors.surfaceContainerHighest}
          shape={Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6,
            bottomStart: index > 0 && index === users.length - 1 ? 18 : 6, bottomEnd: index > 0 && index === users.length - 1 ? 18 : 6 } })}
          onClick={() => { void hide(() => controller.selectUser(picker.id, user)); }} modifiers={[fillMaxWidth()]}>
          <Column modifiers={[fillMaxWidth(), padding(18, 16, 18, 16)]} verticalArrangement={{ spacedBy: 6 }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold' }}>{user.name}</Text><Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{adminUserRoleLabel(user)}</Text>
          </Column>
        </Surface>)}
      </LazyColumn>
    </Column>
  </ModalBottomSheet>;
}

/** @v2 _WarehouseCreateCard
 * Includes M3PickerSheet; mounting it does not expose the unfinished Warehouse screen. */
export function AdminWarehouseCreateDialog(props: AdminWarehouseCreateProps) {
  const model = useAdminWarehouseCreate(props), { state, controller, a, current } = model, colors = useMaterialColors(), { width: screenWidth } = useWindowDimensions(), insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null), message = state.notice ? a(state.notice.key) : '';
  useEffect(() => {
    if (current && state.notice && shown.current !== state.notice.serial) {
      shown.current = state.notice.serial; void snackbar.current?.showSnackbar({ message, duration: 'short' });
    }
  }, [current, state.notice, message]);
  if (!current) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <BaseHost style={styles.host}><BasicAlertDialog onDismissRequest={() => controller.dismissDialog()} properties={{ usePlatformDefaultWidth: false }}>
      <Surface color={colors.surfaceContainerLowest} shadowElevation={6} shape={shape(18)} modifiers={[width(Math.max(0, Math.min(440, screenWidth - 40)))]}>
        <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge', fontWeight: '800' }} modifiers={[weight(1)]}>{a('warehouse.create')}</Text>
            <IconButton enabled={!state.saving} onClick={() => controller.closeButton()} modifiers={[size(48, 48), semantics({ contentDescription: a('action.close') })]}><Icon name="close" color={colors.onSurface} /></IconButton>
          </Row><Spacer modifiers={[height(12)]} />
          <NameField key={state.fillVersion} label={a('warehouse.name')} value={state.name} change={value => controller.changeName(value)} save={model.save} />
          <Spacer modifiers={[height(12)]} />
          <Surface onClick={() => { void controller.openPicker(); }} color={colors.surface} border={{ color: colors.outlineVariant, width: 1 }} shape={shape(12)} modifiers={[fillMaxWidth(), testID('admin-warehouse-create-assignee')]}>
            <Row modifiers={[fillMaxWidth(), padding(12, 10, 12, 10)]} verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
              <Icon name="person_search" color={colors.onSurfaceVariant} /><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
                <Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{a('warehouse.assign_to')}</Text>
                <Text style={{ typography: 'bodyLarge', fontWeight: state.selected ? 'bold' : 'normal' }}>{state.selected?.name ?? a(state.loadingUsers ? 'action.loading' : 'warehouse.pick_user')}</Text>
                {state.selected ? <Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{adminUserRoleLabel(state.selected)}</Text> : null}
              </Column>{state.loadingUsers ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Icon name="expand_more" color={colors.onSurfaceVariant} />}
            </Row>
          </Surface><Spacer modifiers={[height(14)]} />
          <Button onClick={model.save} enabled={!state.saving} shape={shape(20)} modifiers={[fillMaxWidth(), height(56), testID('admin-warehouse-create-save')]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Icon name="link" color={colors.onPrimary} size={18} />}<Text>{a('warehouse.assign')}</Text></Row>
          </Button>
        </Column>
      </Surface>
      {state.picker ? <AssigneePicker key={state.picker.id} model={model} /> : null}
    </BasicAlertDialog></BaseHost>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, notice: { position: 'absolute', left: 16, right: 16 } });

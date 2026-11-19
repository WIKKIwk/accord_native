import { BasicAlertDialog, Button, CircularProgressIndicator, Column, IconButton, OutlinedTextField, RNHostView, Row, Shape, SnackbarHost, Spacer, Surface, Text,
  useMaterialColors, useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, semantics, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { adminUserRoleLabel } from './adminUsersModel';
import { AdminWarehouseAssigneePicker } from './AdminWarehouseAssigneePicker.android';
import type { AdminWarehouseCreateProps } from './AdminWarehouseCreateTypes';
import { useAdminWarehouseCreate } from './useAdminWarehouseCreate';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function Icon({ name, color, size: iconSize = 24 }: { name: 'close' | 'person_search' | 'expand_more' | 'link'; color: string; size?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} /></RNHostView>;
}
function NameField({ label, value, change, save }: { label: string; value: string; change: (text: string) => void; save: () => void }) {
  const text = useNativeState(value), colors = useMaterialColors();
  return <OutlinedTextField value={text} onValueChange={change} singleLine shape={shape(12)} keyboardOptions={{ imeAction: 'done' }} keyboardActions={{ onDone: save }}
    colors={{ focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface }} modifiers={[fillMaxWidth(), testID('admin-warehouse-create-name')]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}
/** @v2 _WarehouseCreateCard
 * Includes the source assignee picker. */
export function AdminWarehouseCreateDialog(props: AdminWarehouseCreateProps) {
  const model = useAdminWarehouseCreate(props), { state, controller, a, current } = model, colors = useMaterialColors(), { width: screenWidth } = useWindowDimensions(), insets = useSafeAreaInsets();
  const picker = state.picker;
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
      {picker && <AdminWarehouseAssigneePicker key={picker.id} users={model.users} query={picker.query}
        title={a('warehouse.assign_to')} hint={a('warehouse.user_search')} closeLabel={a('action.close')} emptyLabel={model.t('noRecordsYet')}
        searchTestID="admin-warehouse-assignee-search" onSearch={query => controller.searchPicker(picker.id, query)}
        onSelect={user => controller.selectUser(picker.id, user)} onDismiss={() => controller.dismissPicker(picker.id)} />}
    </BasicAlertDialog></BaseHost>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, notice: { position: 'absolute', left: 16, right: 16 } });

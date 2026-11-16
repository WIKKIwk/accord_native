import { BasicAlertDialog, BasicTextField, Box, Button, CircularProgressIndicator, Column, FlowRow, HorizontalDivider, IconButton, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, semantics, size, testID, verticalScroll, weight, width as nativeWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { uiText } from '../shared/localization';
import type { AdminCustomerDetailScreenProps, AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminCustomerControls, useAdminCustomerPhoneEditor, useAdminCustomerPromptHost, useAdminCustomerWarehouseProps, type AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

export const roundedCustomer = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export const customerAlpha = (color: string, alpha: string) => `${color.slice(0, 7)}${alpha}`;
export type CustomerAndroidIcon = 'arrow_back' | 'phone' | 'shopping_bag' | 'category' | 'warehouse' | 'edit' | 'edit_note' | 'check' | 'content_copy' | 'refresh' | 'close' | 'add' | 'remove' | 'search';
export function CustomerIcon({ name, color, iconSize = 24 }: { name: CustomerAndroidIcon; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
export function CustomerPhoneField({ model }: { model: AdminCustomerDetailScreenModel }) {
  const { detail } = model, native = useNativeState(dartTrim(detail.phone)), editor = useAdminCustomerPhoneEditor({ detail, current: model.current,
    interactive: model.controlsCurrent, savingPhone: model.state.savingPhone, savePhone: model.savePhone }, native), { colors } = useBaseTheme(), phone = dartTrim(detail.phone);
  return <Surface color={colors.surfaceContainerHighest} shape={roundedCustomer(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
    {editor.editing ? <BasicTextField value={native} singleLine autoFocus keyboardOptions={{ keyboardType: 'phone', imeAction: 'done' }} keyboardActions={{ onDone: () => { void editor.submit(); } }}
      textStyle={{ color: colors.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '500' }} modifiers={[weight(1), semantics({ contentDescription: model.a('profile.phone') }), testID('admin-customer-detail-phone-input')]}>
      <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ typography: 'titleMedium' }}>{uiText('+998 90 123 45 67', model.locale)}</Text></BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
    </BasicTextField> : <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{phone || model.a('profile.entered')}</Text>}
    <IconButton enabled={!model.state.savingPhone} onClick={editor.action} modifiers={[size(48, 48), testID('admin-customer-detail-phone-action'), semantics({ contentDescription: model.a(editor.editing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone') })]}>
      {model.state.savingPhone ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <CustomerIcon name={editor.editing ? 'check' : 'edit'} color={colors.onSurfaceVariant} />}
    </IconButton>
  </Row></Surface>;
}
export function CustomerControls({ model, props }: { model: AdminCustomerDetailScreenModel; props: AdminCustomerDetailScreenProps }) {
  const { state, detail, mode } = model, controls = useAdminCustomerControls(model), { colors } = useBaseTheme(), hasCode = !!dartTrim(detail.code);
  const action = (label: string, click: () => void, id: string, enabled = true) => <OutlinedButton enabled={enabled} onClick={click} shape={roundedCustomer(14)} colors={{ contentColor: colors.onSurface }}
    modifiers={[fillMaxWidth(), height(54), testID(id)]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{label}</Text></OutlinedButton>;
  const warehouse = model.materialWarehouse;
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
    <HorizontalDivider thickness={1} color={customerAlpha(colors.outlineVariant, 'B3')} /><Spacer modifiers={[height(14)]} /><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[height(14)]} />
    <Text style={{ typography: 'bodySmall' }}>{model.a('profile.phone')}</Text><Spacer modifiers={[height(6)]} /><CustomerPhoneField model={model} />
    <Spacer modifiers={[height(14)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.access_code')}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={colors.surfaceContainerHighest} shape={roundedCustomer(14)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
      <Text style={{ typography: 'titleMedium' }} modifiers={[weight(1)]}>{hasCode ? detail.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <IconButton onClick={controls.copy} modifiers={[size(48, 48), testID('admin-customer-detail-copy-code')]}><CustomerIcon name="content_copy" color={colors.onSurfaceVariant} /></IconButton> : null}
      <IconButton enabled={!state.regenerating} onClick={controls.regenerate} modifiers={[size(48, 48), testID('admin-customer-detail-code-regenerate')]}>{state.regenerating ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <CustomerIcon name="refresh" color={colors.onSurfaceVariant} />}</IconButton>
    </Row></Surface>
    {hasCode ? <><Spacer modifiers={[height(8)]} /><Text style={{ typography: 'bodySmall' }}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {detail.code_retry_after_sec > 0 ? <><Spacer modifiers={[height(12)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('profile.code_wait', { seconds: detail.code_retry_after_sec })}</Text></> : null}
    {mode.material ? <>
      <Spacer modifiers={[height(18)]} /><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }}>{model.a('item.group')}</Text><Spacer modifiers={[height(8)]} />
      <Text color={detail.assigned_item_groups.length ? colors.onSurfaceVariant : colors.error} style={{ typography: 'bodySmall' }}>{model.a(detail.assigned_item_groups.length ? 'detail.groups_scope' : 'detail.groups_unassigned')}</Text>
      {detail.assigned_item_groups.length ? <><Spacer modifiers={[height(10)]} /><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
        {detail.assigned_item_groups.map((group, index) => <Surface key={`${group}:${index}`} color={colors.surfaceContainerHigh} border={{ width: 1, color: colors.outlineVariant }} shape={roundedCustomer(14)}>
          <Row verticalAlignment="center" modifiers={[padding(10, 8, 10, 8)]}><CustomerIcon name="category" color={colors.onSurfaceVariant} iconSize={17} /><Spacer modifiers={[size(8, 1)]} /><Text style={{ typography: 'bodyMedium' }}>{group}</Text></Row>
        </Surface>)}
      </FlowRow></> : null}<Spacer modifiers={[height(12)]} />
      <OutlinedButton enabled={!state.editingGroups} onClick={controls.editGroups} shape={roundedCustomer(14)} colors={{ contentColor: colors.onSurface }} modifiers={[fillMaxWidth(), height(54), testID('admin-material-detail-edit-item-groups')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{state.editingGroups ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <CustomerIcon name="edit" color={colors.onSurface} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(state.editingGroups ? 'detail.loading' : 'detail.edit_groups')}</Text></Row>
      </OutlinedButton><Spacer modifiers={[height(18)]} />
      {warehouse ? <RNHostView matchContents={{ vertical: true }}><View style={styles.fullWidth}><CustomerWarehouseEditor key={`${warehouse.principalRole}:${warehouse.principalRef}`} warehouse={warehouse} props={props} controls={controls} /></View></RNHostView> : null}
    </> : null}
    {mode.items ? <><Spacer modifiers={[height(18)]} /><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }}>{model.a('detail.assigned_items')}</Text><Spacer modifiers={[height(10)]} />
      <Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{detail.assigned_items.length ? model.a('detail.assigned_items_count', { count: detail.assigned_items.length }) : model.a('detail.assigned_items_empty')}</Text>
      <Spacer modifiers={[height(12)]} /><Row modifiers={[fillMaxWidth()]}><Column modifiers={[weight(1)]}>{action(model.a('detail.items_view'), controls.openAssigned, 'admin-customer-detail-items-view', !!detail.assigned_items.length)}</Column><Spacer modifiers={[size(12, 1)]} />
        <Column modifiers={[weight(1)]}>{action(model.a(state.addingItem ? 'detail.items_adding' : 'detail.add'), controls.openAvailable, 'admin-customer-detail-items-add', !state.addingItem)}</Column>
      </Row></> : null}
    {mode.remove ? <><Spacer modifiers={[height(8)]} />{action(model.a(state.removing ? 'detail.removing' : 'detail.remove_from_system'), controls.requestRemove, 'admin-customer-detail-remove', !state.removing)}</> : null}
  </Column></BaseHost>;
}
export function CustomerWarehouseEditor({ warehouse, props, controls }: { warehouse: AdminCustomerMaterialWarehouseProps; props: AdminCustomerDetailScreenProps; controls: ReturnType<typeof useAdminCustomerControls> }) {
  return props.renderMaterialWarehouseEditor(useAdminCustomerWarehouseProps(warehouse, controls.lifetimeCurrent, controls.current));
}
export function CustomerInfoChip({ label, icon }: { label: string; icon: 'phone' | 'category' | 'warehouse' | 'shopping_bag' }) {
  const { colors } = useBaseTheme();
  return <Surface color={customerAlpha(colors.surfaceContainerHighest, 'B8')} shape={roundedCustomer(999)}><Row verticalAlignment="center" modifiers={[padding(10, 8, 10, 8)]}>
    <CustomerIcon name={icon} iconSize={15} color={colors.onSurfaceVariant} /><Spacer modifiers={[size(6, 1)]} /><Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', fontWeight: '600' }}>{label}</Text>
  </Row></Surface>;
}
export function CustomerPromptContent({ model }: { model: AdminCustomerDetailScreenModel }) {
  const host = useAdminCustomerPromptHost(model), labels = model.promptText!, { colors } = useBaseTheme(), { width } = useWindowDimensions();
  if (!host.visible) return null;
  return <BasicAlertDialog properties={{ usePlatformDefaultWidth: false }} onDismissRequest={() => host.choose(false)}>
    <Surface color={colors.surfaceContainerHigh} shape={roundedCustomer(28)} border={{ width: 1, color: customerAlpha(colors.outlineVariant, 'A6') }} modifiers={[nativeWidth(Math.min(420, Math.max(0, width - 48)))]}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 24, 24, 20)]}><Text style={{ typography: 'headlineSmall' }}>{labels.title}</Text><Spacer modifiers={[height(10)]} />
        <Text style={{ typography: 'bodyLarge', lineHeight: 23.2 }} color={colors.onSurfaceVariant}>{labels.body}</Text><Spacer modifiers={[height(22)]} />
        <Row modifiers={[fillMaxWidth()]}><Surface shape={roundedCustomer(20)} border={{ width: 1, color: customerAlpha(colors.outlineVariant, 'F2') }} modifiers={[weight(1)]}>
          <Button onClick={() => host.choose(false)} shape={roundedCustomer(20)} colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }} modifiers={[fillMaxWidth(), height(56), testID('admin-customer-detail-remove-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{labels.cancel}</Text></Button>
        </Surface><Spacer modifiers={[size(12, 1)]} /><Button onClick={() => host.choose(true)} shape={roundedCustomer(20)} colors={{ containerColor: labels.destructive ? colors.errorContainer : colors.primaryContainer, contentColor: labels.destructive ? colors.onErrorContainer : colors.onPrimaryContainer }}
          modifiers={[weight(1), height(56), testID('admin-customer-detail-remove-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{labels.confirm}</Text></Button></Row>
      </Column>
    </Surface>
  </BasicAlertDialog>;
}
export function CustomerPrompt({ model }: { model: AdminCustomerDetailScreenModel }) { return <BaseHost style={styles.dialogHost}><CustomerPromptContent model={model} /></BaseHost>; }
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, dialogHost: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });

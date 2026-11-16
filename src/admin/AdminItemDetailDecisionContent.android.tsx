import { Box, Button, Column, Row, Spacer, Surface, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { FlatList, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { useAdminItemDetailDecisionContent, type AdminItemDetailDecisionContentModel } from './AdminItemDetailDecisionContentOwner';
import type { AdminItemDetailDecisionContentProps } from './AdminItemDetailDecisionContentTypes';
import { DecisionField, DecisionIcon, decisionRounded } from './AdminItemDetailDecisionNative.android';

type BodyProps = { model: AdminItemDetailDecisionContentModel; props: AdminItemDetailDecisionContentProps };
function Edit({ model, props }: BodyProps) {
  const code = useNativeState(model.initialDraft!.code), name = useNativeState(model.initialDraft!.name), { colors } = useBaseTheme();
  const save = () => { if (!model.lifetime.canInteract()) return; try { model.save(code.get(), name.get()); } catch { /* Released native buffers cannot accept a command. */ } };
  return <BaseHost matchContents={{ vertical: true }} style={styles.editDialog}><Surface color={colors.surfaceContainerHigh} shape={decisionRounded(28)}><Column modifiers={[fillMaxWidth(), padding(24, 24, 24, 24)]}>
    <Text style={{ typography: 'headlineSmall', fontSize: 24, fontWeight: '400' }}>{model.title}</Text><Spacer modifiers={[height(16)]} />
    <DecisionField value={code} singleLine enabled={!model.closing} shape={decisionRounded(16)} textStyle={{ fontSize: 16, fontWeight: '400' }} keyboardOptions={{ autoCorrectEnabled: false, imeAction: 'next' }}
      onValueChange={value => model.changeEdit('code', value)} modifiers={[fillMaxWidth(), testID('admin-item-detail-code-field')]}><DecisionField.Label><Text style={{ fontSize: 14 }}>{props.a('detail.item_code')}</Text></DecisionField.Label></DecisionField>
    <Spacer modifiers={[height(14)]} /><DecisionField value={name} singleLine enabled={!model.closing} shape={decisionRounded(16)} textStyle={{ fontSize: 16, fontWeight: '400' }} keyboardOptions={{ capitalization: 'sentences', imeAction: 'done' }} keyboardActions={{ onDone: save }}
      onValueChange={value => model.changeEdit('name', value)} modifiers={[fillMaxWidth(), testID('admin-item-detail-name-field')]}><DecisionField.Label><Text style={{ fontSize: 14 }}>{props.a('detail.item_name')}</Text></DecisionField.Label></DecisionField>
    {model.validation ? <><Spacer modifiers={[height(10)]} /><Text color={colors.error} style={{ typography: 'bodyMedium' }} modifiers={[testID('admin-item-detail-validation')]}>{model.validation}</Text></> : null}
    <Spacer modifiers={[height(24)]} /><Row horizontalArrangement="end" verticalAlignment="center" modifiers={[fillMaxWidth()]}><TextButton enabled={!model.closing} onClick={() => model.close(false)}><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('action.cancel')}</Text></TextButton><Spacer modifiers={[size(8, 1)]} />
      <Button enabled={!model.closing} onClick={save} shape={decisionRounded(20)} modifiers={[defaultMinSize({ minHeight: 56 }), testID('admin-item-detail-save')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('action.save')}</Text></Button>
    </Row>
  </Column></Surface></BaseHost>;
}
function Delete({ model, props }: BodyProps) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={styles.dialog}><Surface color={colors.surfaceContainerHigh} shape={decisionRounded(28)}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(24, 24, 24, 24)]}>
    <DecisionIcon name="delete_forever" color={colors.error} /><Spacer modifiers={[height(16)]} /><Text style={{ typography: 'headlineSmall', fontSize: 24, fontWeight: '400', textAlign: 'center' }}>{model.title}</Text><Spacer modifiers={[height(16)]} />
    <Text color={colors.onSurface} style={{ typography: 'bodyMedium' }} modifiers={[fillMaxWidth()]}>{model.deleteMessage}</Text><Spacer modifiers={[height(24)]} />
    <Row horizontalArrangement="end" verticalAlignment="center" modifiers={[fillMaxWidth()]}><TextButton enabled={!model.closing} onClick={() => model.close(false)} modifiers={[testID('admin-item-delete-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('action.cancel')}</Text></TextButton><Spacer modifiers={[size(8, 1)]} />
      <Button enabled={!model.closing} onClick={() => model.close(true)} colors={{ containerColor: colors.error, contentColor: colors.onError }} shape={decisionRounded(20)} modifiers={[defaultMinSize({ minHeight: 56 }), testID('admin-item-delete-confirm')]}><Row verticalAlignment="center"><DecisionIcon name="delete_forever" color={colors.onError} size={18} /><Spacer modifiers={[size(8, 1)]} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('action.delete')}</Text></Row></Button>
    </Row>
  </Column></Surface></BaseHost>;
}
function Group({ model, props }: BodyProps) {
  const query = useNativeState(model.query), { colors } = useBaseTheme(), viewport = model.viewport!;
  return <View style={[styles.sheet, { height: viewport.height * .74 }]} testID="admin-item-group-content"><BaseHost matchContents={{ vertical: true }} style={styles.full}><Column modifiers={[fillMaxWidth()]}>
    <Text style={{ typography: 'titleLarge', fontWeight: '800' }} modifiers={[padding(18, 0, 18, 12)]}>{model.title}</Text><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
      <DecisionField value={query} singleLine enabled={!model.closing} shape={decisionRounded(16)} textStyle={{ fontSize: 16, fontWeight: '400' }} onValueChange={model.changeQuery} modifiers={[fillMaxWidth(), testID('admin-item-group-search')]}><DecisionField.Label><Text style={{ fontSize: 14 }}>{props.a('detail.item_group_search')}</Text></DecisionField.Label><DecisionField.LeadingIcon><DecisionIcon name="search" color={colors.onSurface} /></DecisionField.LeadingIcon></DecisionField>
    </Column><Spacer modifiers={[height(10)]} />
  </Column></BaseHost>
    {model.groups.length ? <FlatList style={styles.fill} data={model.groups} keyExtractor={row => row.value} keyboardShouldPersistTaps="handled" renderItem={({ item: row }) => <BaseHost matchContents={{ vertical: true }} style={styles.full}><Surface enabled={!model.closing} selected={row.selected} onClick={() => model.chooseGroup(row.value, model.query)} color={colors.surfaceContainerLow} contentColor={row.selected ? colors.primary : colors.onSurface} modifiers={[testID(`admin-item-group-option-${row.value}`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), padding(16, 8, 16, 8)]}><Box modifiers={[size(40, 24)]}><DecisionIcon name={row.selected ? 'radio_button_checked' : 'radio_button_unchecked'} color={row.selected ? colors.primary : colors.onSurfaceVariant} /></Box><Spacer modifiers={[size(16, 1)]} /><Text style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>{row.value}</Text></Row>
    </Surface></BaseHost>} /> : <View style={styles.center}><BaseHost matchContents><Text style={{ typography: 'bodyMedium' }}>{props.a('detail.item_group_not_found')}</Text></BaseHost></View>}
    <View style={{ paddingLeft: 16, paddingTop: 10, paddingRight: 16, paddingBottom: viewport.paddingBottom + 16 }}><BaseHost matchContents={{ vertical: true }} style={styles.full}><Button enabled={model.applyEnabled} onClick={() => model.close(true)} shape={decisionRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-group-apply')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('detail.item_group_save')}</Text></Button></BaseHost></View>
  </View>;
}
/** @v2 _AdminItemEditDialog / _ItemGroupPickerSheet; CONTENT only, never a native-close receipt. */
export function AdminItemDetailDecisionContent(props: AdminItemDetailDecisionContentProps) {
  const model = useAdminItemDetailDecisionContent(props); if (!model.visible || props.kind === 'group' && !model.viewport) return null;
  return props.kind === 'edit' ? <Edit key={model.lifetime.bufferIdentity} model={model} props={props} /> : props.kind === 'delete' ? <Delete model={model} props={props} /> : <Group key={model.lifetime.bufferIdentity} model={model} props={props} />;
}
const styles = StyleSheet.create({ full: { width: '100%' }, dialog: { width: '100%' }, editDialog: { width: '100%', maxWidth: 468 }, sheet: { width: '100%' }, fill: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });

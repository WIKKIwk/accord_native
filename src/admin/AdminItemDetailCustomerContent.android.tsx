import { Box, Button, Checkbox, CircularProgressIndicator, Column, HorizontalDivider, IconButton, Row, Spacer, Surface, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { FlatList, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminText as Text } from './AdminTypography.android';
import { useAdminItemDetailCustomerContent, type AdminItemDetailCustomerContentModel } from './AdminItemDetailCustomerContentOwner';
import type { AdminItemDetailCustomerContentProps } from './AdminItemDetailCustomerContentTypes';
import { DecisionField, DecisionIcon, decisionRounded } from './AdminItemDetailDecisionNative.android';

type BodyProps = { model: AdminItemDetailCustomerContentModel; props: AdminItemDetailCustomerContentProps };
function Content({ model, props }: BodyProps) {
  const query = useNativeState(''), { colors } = useBaseTheme(), viewport = model.viewport!, state = model.state!;
  const search = (button: boolean) => { if (!model.lifetime.canInteract()) return; try { (button ? model.searchButton : model.searchSubmit)(query.get()); } catch { /* No command from a released native buffer. */ } };
  return <View style={[styles.sheet, { height: viewport.height * .84 }]} testID="admin-item-customer-content"><BaseHost matchContents={{ vertical: true }} style={styles.full}><Column modifiers={[fillMaxWidth()]}>
    <Text style={{ typography: 'titleLarge', fontWeight: '800' }} modifiers={[padding(18, 0, 18, 12)]}>{model.title}</Text><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
      <DecisionField value={query} singleLine enabled={!model.closing} shape={decisionRounded(16)} textStyle={{ fontSize: 16, fontWeight: '400' }} keyboardOptions={{ imeAction: 'search' }} keyboardActions={{ onSearch: () => search(false) }} onValueChange={model.changeSearch} modifiers={[fillMaxWidth(), testID('admin-item-customer-search')]}>
        <DecisionField.Label><Text style={{ fontSize: 14 }}>{props.a('detail.customer_search')}</Text></DecisionField.Label><DecisionField.LeadingIcon><DecisionIcon name="search" color={colors.onSurface} /></DecisionField.LeadingIcon><DecisionField.TrailingIcon><IconButton enabled={model.searchEnabled} onClick={() => search(true)} modifiers={[semantics({ contentDescription: props.a('action.search') }), testID('admin-item-customer-search-submit')]}><DecisionIcon name="arrow_forward" color={colors.onSurface} /></IconButton></DecisionField.TrailingIcon>
      </DecisionField>
    </Column><Spacer modifiers={[height(10)]} />
  </Column></BaseHost>
    {state.loading ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View>
      : state.error !== null ? <View style={styles.fill}><View style={styles.retryPadding}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%', maxWidth: Math.max(280, Math.min(360, viewport.width * .88)) }}><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Text color={colors.onSurfaceVariant} style={{ fontSize: 16, textAlign: 'center', lineHeight: 21.6 }}>{props.a('detail.customer_load_failed')}</Text><Spacer modifiers={[height(16)]} /><TextButton onClick={model.retry} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-item-customer-retry')]}><Text style={{ fontSize: 14, fontWeight: '600' }}>{props.t('retry')}</Text></TextButton></Column></BaseHost></View></View>
        : !model.rows.length ? <View style={styles.center}><BaseHost matchContents><Text style={{ typography: 'bodyMedium' }}>{props.a('detail.customer_not_found')}</Text></BaseHost></View>
          : <FlatList style={styles.fill} contentContainerStyle={styles.list} data={model.rows} keyExtractor={row => row.customer.ref} keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <BaseHost matchContents={{ vertical: true }} style={styles.full}><HorizontalDivider /></BaseHost>} renderItem={({ item: row }) => <BaseHost matchContents={{ vertical: true }} style={styles.full}><Surface checked={row.selected} enabled={state.pendingRef === null && !model.closing} onCheckedChange={value => model.toggle(row, value)} color={colors.surfaceContainerLow} modifiers={[testID(row.key)]}>
            <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 72 }), padding(16, 8, 16, 8)]}><Box contentAlignment="center" modifiers={[size(40, 40)]}>{row.pending ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(24, 24)]} /> : <Surface color={colors.primaryContainer} contentColor={colors.onPrimaryContainer} shape={decisionRounded(20)}><Box contentAlignment="center" modifiers={[size(40, 40)]}><DecisionIcon name="business" color={colors.onPrimaryContainer} /></Box></Surface>}</Box><Spacer modifiers={[size(16, 1)]} />
              <Column modifiers={[weight(1)]}><Text style={{ typography: 'bodyLarge' }}>{row.title}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{row.subtitle}</Text></Column><Spacer modifiers={[size(16, 1)]} /><Checkbox value={row.selected} enabled={state.pendingRef === null && !model.closing} />
            </Row>
          </Surface></BaseHost>} />}
    <View style={{ paddingLeft: 16, paddingTop: 10, paddingRight: 16, paddingBottom: viewport.paddingBottom + 16 }}><BaseHost matchContents={{ vertical: true }} style={styles.full}><Button enabled={model.doneEnabled} onClick={() => model.close(true)} shape={decisionRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-customer-done')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{props.a('detail.done')}</Text></Button></BaseHost></View>
  </View>;
}
/** @v2 _ItemCustomerPickerSheet; native CONTENT only. The actual host owns activation, swipe/back and native close acknowledgment. */
export function AdminItemDetailCustomerContent(props: AdminItemDetailCustomerContentProps) {
  const model = useAdminItemDetailCustomerContent(props); if (!model.visible || !model.viewport) return null;
  return <Content key={model.lifetime.bufferIdentity} model={model} props={props} />;
}
const styles = StyleSheet.create({ full: { width: '100%' }, sheet: { width: '100%' }, fill: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, list: { paddingHorizontal: 8 }, retryPadding: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' } });

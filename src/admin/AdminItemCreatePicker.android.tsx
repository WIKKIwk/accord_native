import { Box, Button, CircularProgressIndicator, Column, FilledTonalButton, IconButton, ModalBottomSheet, RNHostView, Row, Shape, Spacer, Surface, useNativeState, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { clip, defaultMinSize, fillMaxWidth, height, padding, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, ScrollView, StyleSheet, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminBasicTextField as BasicTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import { adminItemCreatePickerRows } from './adminItemCreatePickerPresentation';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import { useAdminPresentationWindow } from './useAdminPresentationWindow';

const alpha = (value: string, opacity: number) => `${value.slice(0, 7)}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
/** @v2 M3AsyncPickerSheet */
export function AdminItemCreatePicker({ model, observer }: { model: AdminItemCreateScreenModel; observer: AdminPresentationWindowObserver }) {
  const picker = model.state.picker!, state = model.state.pickerState!, { colors } = useBaseTheme(), { height: viewport } = useWindowDimensions();
  const sheet = useRef<ModalBottomSheetRef>(null), marker = useRef<ViewInstance>(null), hiding = useRef(false), hideDone = useRef(false), [hideAcknowledged, setHideAcknowledged] = useState(false);
  const query = useNativeState(state.searchDraft), rows = adminItemCreatePickerRows(picker), create = picker.kind === 'customer' && model.owner.needsCustomerCreate, { current, owner: screenOwner } = model;
  const options = useMemo(() => {
    const generation = picker.controller.interactionGeneration;
    const isCurrent = () => current() && screenOwner.controller.getSnapshot().picker === picker && picker.controller.isCurrent(generation);
    return { identity: Object.freeze({}), observer, ticket: createAdminPresentationWindowTicket(), isCurrent,
      isClosing: () => hideDone.current && isCurrent() && picker.controller.getSnapshot().closing,
      onDetached: () => { if (isCurrent() && picker.controller.getSnapshot().closing) picker.controller.completeClose(); } };
  }, [picker, observer, current, screenOwner]);
  const window = useAdminPresentationWindow(options, state.closing && hideAcknowledged);
  useEffect(() => { if (!state.closing || hiding.current) return; const original = sheet.current; if (!original) return; hiding.current = true;
    void original.hide().then(() => { if (!options.isCurrent() || !picker.controller.getSnapshot().closing) return; hideDone.current = true; setHideAcknowledged(true); }).catch(() => { hiding.current = false; });
  }, [state.closing, options, picker]);
  const select = (item: typeof rows[number]['item']) => { if (typeof item === 'string') model.selectPickerString(item); else model.selectCustomer(item); };
  const shape = Shape.RoundedCorner({ cornerRadii: { topStart: 32, topEnd: 32, bottomStart: 0, bottomEnd: 0 } });
  if (!window.state.present) return null;
  return <ModalBottomSheet ref={sheet} onDismissRequest={model.dismissPicker} showDragHandle={false} sheetGesturesEnabled skipPartiallyExpanded initialFullyExpanded containerColor={colors.surfaceContainerLow} scrimColor="rgba(0,0,0,.32)" modifiers={[clip(Shapes.RoundedCorner({ topStart: 32, topEnd: 32, bottomStart: 0, bottomEnd: 0 }))]}>
    <Surface color={colors.surfaceContainerLow} shape={shape} border={{ width: 1, color: alpha(colors.outlineVariant, .24) }}><RNHostView matchContents><View style={{ maxHeight: viewport * .66, height: !rows.length || state.loading || state.error !== null ? viewport * .66 : undefined, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 }}>
      <View ref={marker} collapsable={false} nativeID={options.ticket} pointerEvents="none" accessible={false} style={styles.marker} onLayout={() => { const tag = findNodeHandle(marker.current); if (typeof tag === 'number') window.owner.markerTag(tag); }} />
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Surface color={colors.outlineVariant} shape={itemCreateRounded(999)} modifiers={[size(36, 4)]} /></Column><Spacer modifiers={[height(14)]} />
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>{model.a(`item.${picker.kind}_select`)}</Text>
          {create ? <IconButton enabled={!state.runningEmptyAction} onClick={() => model.createCustomer(true)} modifiers={[size(48, 48), semantics({ contentDescription: model.a('user.add_customer') }), testID('admin-item-create-picker-add')]}><ItemCreateIcon name="add" color={colors.onSurfaceVariant} /></IconButton> : null}
          <IconButton onClick={model.dismissPicker} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') }), testID('admin-item-create-picker-close')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton>
        </Row><Spacer modifiers={[height(14)]} />
        <Surface color={colors.surfaceContainerHighest} shape={itemCreateRounded(999)} border={{ width: 1, color: alpha(colors.outlineVariant, .56) }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 58 })]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(18, 0, 18, 0)]}>
          <ItemCreateIcon name="search" color={colors.onSurfaceVariant} size={26} /><Spacer modifiers={[size(12, 1)]} /><BasicTextField value={query} singleLine onValueChange={model.pickerSearch} textStyle={{ color: colors.onSurface, fontSize: 16, fontWeight: '700' }} modifiers={[weight(1), height(58), testID('admin-item-create-picker-search')]}>
            <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), height(58)]}><BasicTextField.InnerTextField /><BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 16, fontWeight: '700' }}>{model.a(`item.${picker.kind}_search`)}</Text></BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
          </BasicTextField>
        </Row></Surface><Spacer modifiers={[height(14)]} />
      </Column></BaseHost>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={[styles.scroll, { flexGrow: state.loading || state.error !== null || !rows.length ? 1 : 0 }]} contentContainerStyle={state.loading || state.error !== null || !rows.length ? styles.emptyBody : undefined} onScroll={event => { const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent; model.pickerScroll(contentSize.height - contentOffset.y - layoutMeasurement.height); }} scrollEventThrottle={16}>
        <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
          {state.loading ? <AdminLoadingIndicator /> : state.error !== null ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(12)]} /><FilledTonalButton onClick={model.pickerReload} shape={itemCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-create-picker-retry')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.t('retry')}</Text></FilledTonalButton></Column> : !rows.length ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}>
            {create && dartTrim(state.query) ? <Button enabled={!state.runningEmptyAction} onClick={() => model.createCustomer(false)} shape={itemCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-create-picker-empty-add')]}><Row verticalAlignment="center">{state.runningEmptyAction ? <CircularProgressIndicator color={colors.onPrimary} strokeWidth={2} modifiers={[size(18, 18)]} /> : <ItemCreateIcon name="add" color={colors.onPrimary} />}<Spacer modifiers={[size(8, 1)]} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('user.add_customer')}</Text></Row></Button> : <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{model.t('noRecordsYet')}</Text>}
          </Column> : rows.map((row, index) => <Column key={`${index}:${row.title}`} modifiers={[fillMaxWidth(), ...(index ? [padding(0, 2, 0, 0)] : [])]}><Surface color={colors.surfaceContainerHighest} shape={Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6, bottomStart: index > 0 && index === rows.length - 1 ? 18 : 6, bottomEnd: index > 0 && index === rows.length - 1 ? 18 : 6 } })} onClick={() => select(row.item)} modifiers={[fillMaxWidth(), testID(`admin-item-create-picker-option-${index}`)]}>
            <Column modifiers={[fillMaxWidth(), padding(18, 16, 18, 16)]}><Text style={{ typography: 'titleLarge', fontWeight: '700' }}>{row.title}</Text>{row.subtitle ? <><Spacer modifiers={[height(6)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.subtitle}</Text></> : null}</Column>
          </Surface></Column>)}{!state.loading && state.error === null && rows.length && state.loadingMore ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 18, 0, 18)]}><AdminLoadingIndicator /></Column> : null}
        </Column></BaseHost>
      </ScrollView>
    </View></RNHostView></Surface>
  </ModalBottomSheet>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, scroll: { flexGrow: 0, flexShrink: 1 }, emptyBody: { flexGrow: 1, justifyContent: 'center' }, marker: { position: 'absolute', width: 0, height: 0 } });

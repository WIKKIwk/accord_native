import { Column, CircularProgressIndicator, FilledIconButton, ExtendedFloatingActionButton, FilterChip, FlowRow, Host, IconButton, InputChip, ListItem, OutlinedTextField, RNHostView, Row, Switch, Text, TriStateCheckbox, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { fillMaxWidth, horizontalScroll, semantics, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text as NativeText, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { useQolipRole } from './QolipRoleContext';
import type { StorageFilterProps, StorageListProps, StorageSelectionProps, StorageScannerManualProps } from './qolipStorageViewProps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { extensionText } from '../shared/localization';
import { useQolipText } from './useQolipText';
export function StorageSelectionStrip(props: StorageSelectionProps) {
  return <Host matchContents={{ vertical: true }}><Row horizontalArrangement={{ spacedBy: 6 }} modifiers={[horizontalScroll()]}>
    {props.codes.length ? props.codes.map(code => <InputChip key={code}><InputChip.Label><Text>{code}</Text></InputChip.Label>
      <InputChip.TrailingIcon><IconButton enabled={!props.disabled} onClick={() => props.remove(code)} modifiers={[semantics({ contentDescription: code })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={18} /></RNHostView></IconButton></InputChip.TrailingIcon></InputChip>) : <Text>{props.empty}</Text>}
  </Row></Host>;
}
export function StoragePickerConfirm({ label, disabled, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  return <Host matchContents><ExtendedFloatingActionButton onClick={() => { if (!disabled) onPress(); }}>
    <ExtendedFloatingActionButton.Icon><RNHostView matchContents><SymbolView name={{ android: 'check' }} size={24} /></RNHostView></ExtendedFloatingActionButton.Icon>
    <ExtendedFloatingActionButton.Text><Text>{label}</Text></ExtendedFloatingActionButton.Text>
  </ExtendedFloatingActionButton></Host>;
}
export function StorageFilter(props: StorageFilterProps) {
  return <Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
    <FilterChip selected={props.selected} onClick={props.toggle}><FilterChip.Label><Text>{props.label}</Text></FilterChip.Label>
      <FilterChip.TrailingIcon><RNHostView matchContents><SymbolView name={{ android: props.expanded ? 'expand_less' : 'expand_more' }} size={18} /></RNHostView></FilterChip.TrailingIcon></FilterChip>
    {props.expanded && <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      {props.options.map(option => <FilterChip key={option.value} selected={option.value === props.value} onClick={() => props.choose(option.value)}>
        <FilterChip.Label><Text>{option.label}</Text></FilterChip.Label></FilterChip>)}
    </FlowRow>}
  </Column></Host>;
}
export function StorageToggle({ label, subtitle, value, disabled, onChange }: { label: string; subtitle: string; value: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return <Host matchContents={{ vertical: true }}><ListItem><ListItem.HeadlineContent><Text>{label}</Text></ListItem.HeadlineContent>
    <ListItem.SupportingContent><Text>{subtitle}</Text></ListItem.SupportingContent><ListItem.TrailingContent><Switch value={value} enabled={!disabled} onCheckedChange={onChange} /></ListItem.TrailingContent>
  </ListItem></Host>;
}

export function StorageList(props: StorageListProps) {
  const colors = useMaterialColors(), input = useNativeState(props.query ?? ''), { session } = useQolipRole();
  const ownHeader = !!(props.onBack || props.onMenu), insets = useSafeAreaInsets(), { locale } = useQolipText();
  const [searchFocused, setSearchFocused] = useState(false);
  const dimensions = useRef({ content: 0, viewport: 0, offset: 0 });
  const reportViewport = () => { const d = dimensions.current; if (d.viewport > 0) props.onViewport?.(d.content - d.viewport - d.offset); };
  useEffect(() => { if (input.get() !== (props.query ?? '')) input.set(props.query ?? ''); }, [input, props.query]);
  const list = <FlatList data={props.rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }} refreshing={!!props.loading} onRefresh={props.refresh}
    onLayout={event => { dimensions.current.viewport = event.nativeEvent.layout.height; reportViewport(); }}
    onScroll={event => { const e = event.nativeEvent; dimensions.current = { content: e.contentSize.height, viewport: e.layoutMeasurement.height, offset: e.contentOffset.y }; reportViewport(); }}
    onContentSizeChange={(_width, height) => { dimensions.current.content = height; reportViewport(); }} scrollEventThrottle={100}
    ListHeaderComponent={<View style={{ paddingHorizontal: 12, gap: 12, marginBottom: 12 }}>
      {props.onQuery && !ownHeader && <Host matchContents={{ vertical: true }}><OutlinedTextField value={input} onValueChange={props.onQuery} singleLine modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><Text>{props.searchHint ?? ''}</Text></OutlinedTextField.Label>
      </OutlinedTextField></Host>}{props.header}</View>}
    renderItem={({ item, index }) => item.section ? <NativeText accessibilityRole="header" style={{ color: colors.onSurfaceVariant, fontSize: 16, fontWeight: '600', padding: 16 }}>{item.title}</NativeText> : <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first={index === 0 || props.rows[index - 1]?.section} last={index === props.rows.length - 1 || props.rows[index + 1]?.section}
      onPress={item.onPress} onLongPress={item.onLongPress} disabled={item.disabled}>
      {item.imageOrderId ? <WorkerOrderThumbnail session={session} orderId={item.imageOrderId} imageId="" active size={52}
        backgroundColor={colors.surface} iconColor={colors.onSurfaceVariant} /> : null}
      <View style={{ flex: 1, padding: 8, gap: 4 }}><NativeText style={{ color: colors.onSurface, fontSize: 16, fontWeight: '500' }}>{item.title}</NativeText>
        {!!item.subtitle && <NativeText style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{item.subtitle}</NativeText>}</View>
      {item.onSelect && <Host matchContents><TriStateCheckbox state={item.selected === null ? 'indeterminate' : item.selected ? 'on' : 'off'} enabled={!item.disabled} onClick={item.onSelect} /></Host>}
      {item.trailing && <View style={{ maxWidth: 110 }}><WorkerSheetButton label={item.trailing.label} onPress={item.trailing.onPress} disabled={item.disabled} variant="text" /></View>}
    </WorkerQueueCard>}
    ListFooterComponent={<View style={{ paddingHorizontal: 12, gap: 12 }}>{props.loading && <ActivityIndicator />}{props.footer}</View>} />;
  if (!ownHeader) return list;
  const navigation = props.onBack ? { onBack: props.onBack } : { onMenu: props.onMenu! };
  return <View style={{ flex: 1, paddingTop: insets.top }}>
    {props.onQuery ? <OrdersHeader {...navigation} search={props.query ?? ''} searchPlaceholder={props.searchHint} onSearchChange={props.onQuery} enabled={props.searchEnabled}
      onProfile={props.onProfile} showProfile={!searchFocused} onSearchFocus={() => setSearchFocused(true)} onSearchBlur={() => setSearchFocused(false)}
      actions={!searchFocused && props.refresh && <Host matchContents><IconButton enabled={!props.loading} onClick={props.refresh} modifiers={[semantics({ contentDescription: extensionText('qolipStorageText', 'refresh', locale) })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'refresh' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </IconButton></Host>} /> : <RoleHeader title={props.title ?? ''} navigation={{ icon: 'back', label: 'Orqaga', onPress: props.onBack! }} />}
    {list}{props.dock}
  </View>;
}

/** @v2 ProductionQuickScannerPanel manual-entry row */
export function StorageScannerManual(props: StorageScannerManualProps) {
  const value = useNativeState(props.value);
  useEffect(() => { if (value.get() !== props.value) value.set(props.value); }, [value, props.value]);
  return <Host matchContents={{ vertical: true }} style={{ padding: 12 }}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
    <OutlinedTextField value={value} enabled={!props.busy} singleLine onValueChange={props.change} keyboardOptions={{ imeAction: 'done' }} keyboardActions={{ onDone: props.submit }} modifiers={[weight(1)]}>
      <OutlinedTextField.Label><Text>{props.label}</Text></OutlinedTextField.Label>
    </OutlinedTextField><FilledIconButton enabled={!props.busy} onClick={props.submit} modifiers={[semantics({ contentDescription: props.acceptLabel })]}>
      {props.busy ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <RNHostView matchContents><SymbolView name={{ android: 'check' }} size={24} /></RNHostView>}
    </FilledIconButton>
  </Row></Host>;
}

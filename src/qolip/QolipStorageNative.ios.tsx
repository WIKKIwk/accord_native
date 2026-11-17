import { Button, Host, HStack, Image, List, ProgressView, RNHostView, ScrollView, Section, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, listStyle, onLongPressGesture, refreshable, useScrollGeometryChange, accessibilityLabel, textFieldStyle, onSubmit, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Platform, PlatformColor, Text as NativeText, View } from 'react-native';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { useQolipRole } from './QolipRoleContext';
import type { StorageFilterProps, StorageListProps, StorageSelectionProps, StorageScannerManualProps, StorageRow } from './qolipStorageViewProps';
import { Stack } from 'expo-router';
export function StorageSelectionStrip(props: StorageSelectionProps) {
  return <Host matchContents={{ vertical: true }}><ScrollView axes="horizontal"><HStack spacing={6}>
    {props.codes.length ? props.codes.map(code => <Button key={code} label={code} systemImage="xmark" onPress={() => props.remove(code)}
      modifiers={[buttonStyle('bordered'), frame({ minHeight: 44 }), disabled(props.disabled)]} />) : <Text>{props.empty}</Text>}
  </HStack></ScrollView></Host>;
}
export function StoragePickerConfirm({ label, disabled: blocked, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  return <Host matchContents><Button label={label} systemImage="checkmark" onPress={onPress} modifiers={[buttonStyle('borderedProminent'), frame({ minHeight: 54 }), disabled(blocked)]} /></Host>;
}
export function StorageFilter(props: StorageFilterProps) {
  return <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={8}>
    <Button label={props.label} systemImage={props.expanded ? 'chevron.up' : 'chevron.down'} onPress={props.toggle}
      modifiers={[buttonStyle(props.selected ? 'borderedProminent' : 'bordered'), frame({ minHeight: 44 })]} />
    {props.expanded && props.options.map(option => <Button key={option.value} label={option.label} systemImage={option.value === props.value ? 'checkmark' : undefined}
      onPress={() => props.choose(option.value)} modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity, minHeight: 44 })]} />)}
  </VStack></Host>;
}
export function StorageToggle({ label, subtitle, value, disabled: blocked, onChange }: { label: string; subtitle: string; value: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return <Host matchContents={{ vertical: true }}><Toggle isOn={value} onIsOnChange={onChange} modifiers={[disabled(!!blocked)]}><Text>{label}</Text><Text>{subtitle}</Text></Toggle></Host>;
}

function StorageIosRow({ row }: { row: StorageRow }) {
  const { session } = useQolipRole();
  return <HStack spacing={10}>
    {row.imageOrderId && <RNHostView matchContents><WorkerOrderThumbnail session={session} orderId={row.imageOrderId} imageId="" active size={52} backgroundColor={PlatformColor('secondarySystemGroupedBackground')} iconColor={PlatformColor('secondaryLabel')} /></RNHostView>}
    <Button onPress={row.onPress ?? (() => {})} modifiers={[buttonStyle('plain'), disabled(row.disabled ?? false), frame({ maxWidth: Infinity, alignment: 'leading' }),
      ...(row.onLongPress ? [onLongPressGesture(row.onLongPress)] : [])]}><VStack alignment="leading" spacing={4}>
      <Text modifiers={[font({ size: 17, weight: 'medium' })]}>{row.title}</Text>{row.subtitle && <Text>{row.subtitle}</Text>}
    </VStack></Button>
    {row.onSelect && <Button onPress={row.onSelect} modifiers={[disabled(row.disabled ?? false), frame({ minWidth: 44, minHeight: 44 })]}>
      <Image systemName={row.selected === null ? 'minus.circle' : row.selected ? 'checkmark.circle.fill' : 'circle'} /></Button>}
    {row.trailing && <Button label={row.trailing.label} onPress={row.trailing.onPress} modifiers={[disabled(row.disabled ?? false), buttonStyle('bordered')]} />}
  </HStack>;
}
export function StorageList(props: StorageListProps) {
  const input = useNativeState(props.query ?? '');
  const geometry = useScrollGeometryChange(value => props.onViewport?.(value.contentHeight - value.containerHeight - value.contentOffsetY));
  const dimensions = useRef({ content: 0, viewport: 0, offset: 0 });
  const reportViewport = () => { const d = dimensions.current; if (d.viewport > 0) props.onViewport?.(d.content - d.viewport - d.offset); };
  useEffect(() => { if (input.get() !== (props.query ?? '')) input.set(props.query ?? ''); }, [input, props.query]);
  const search = props.onQuery ? <TextField text={input} placeholder={props.searchHint} onTextChange={props.onQuery} modifiers={[disabled(props.searchEnabled === false)]} /> : undefined;
  const navigation = props.title && props.onBack ? <Stack.Screen options={{ title: props.title, headerShown: true }} /> : undefined;
  // SwiftUI exposes exact scroll geometry from iOS 18. Earlier supported versions use the native
  // UIScrollView-backed FlatList with the same SwiftUI row controls and the source 240-point threshold.
  if (Number.parseInt(String(Platform.Version), 10) < 18) return <>{navigation}<FlatList data={props.rows} keyExtractor={row => row.id}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshing={!!props.loading} onRefresh={props.refresh}
    style={{ backgroundColor: PlatformColor('systemGroupedBackground') }} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}
    onLayout={event => { dimensions.current.viewport = event.nativeEvent.layout.height; reportViewport(); }}
    onScroll={event => { const e = event.nativeEvent; dimensions.current = { content: e.contentSize.height, viewport: e.layoutMeasurement.height, offset: e.contentOffset.y }; reportViewport(); }}
    onContentSizeChange={(_width, height) => { dimensions.current.content = height; reportViewport(); }} scrollEventThrottle={100}
    ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>{search && <Host matchContents={{ vertical: true }}>{search}</Host>}{props.header}</View>}
    renderItem={({ item }) => item.section ? <NativeText accessibilityRole="header" style={{ color: PlatformColor('secondaryLabel'), fontSize: 16, fontWeight: '600', padding: 12 }}>{item.title}</NativeText>
      : <Host matchContents={{ vertical: true }} style={{ padding: 12, borderRadius: 12, backgroundColor: PlatformColor('secondarySystemGroupedBackground') }}><StorageIosRow row={item} /></Host>}
    ListFooterComponent={<View style={{ gap: 12 }}>{props.loading && <ActivityIndicator />}{props.footer}</View>} /></>;
  return <>{navigation}<Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), ...(geometry ? [geometry] : []), ...(props.refresh ? [refreshable(async () => { props.refresh?.(); })] : [])]}>
    {search && <Section>{search}</Section>}
    {props.header && <Section><RNHostView matchContents><View style={{ gap: 12 }}>{props.header}</View></RNHostView></Section>}
    {props.rows.map(row => row.section ? <Section key={row.id}><Text modifiers={[font({ size: 16, weight: 'semibold' })]}>{row.title}</Text></Section>
      : <Section key={row.id}><StorageIosRow row={row} /></Section>)}
    {props.loading && <Section><ProgressView /></Section>}
    {props.footer && <Section><RNHostView matchContents><View style={{ gap: 12 }} onLayout={() => { if (props.rows.every(row => row.section)) props.onViewport?.(0); }}>{props.footer}</View></RNHostView></Section>}
  </List></Host></>;
}

/** @v2 ProductionQuickScannerPanel manual-entry row */
export function StorageScannerManual(props: StorageScannerManualProps) {
  const value = useNativeState(props.value);
  useEffect(() => { if (value.get() !== props.value) value.set(props.value); }, [value, props.value]);
  return <Host matchContents={{ vertical: true }} style={{ padding: 12 }}><HStack spacing={8}>
    <TextField text={value} placeholder={props.label} onTextChange={props.change} modifiers={[textFieldStyle('roundedBorder'), disabled(props.busy), submitLabel('done'), onSubmit(props.submit), frame({ maxWidth: Infinity, minHeight: 48 })]} />
    <Button onPress={props.submit} modifiers={[buttonStyle('borderedProminent'), disabled(props.busy), frame({ minWidth: 48, minHeight: 48 }), accessibilityLabel(props.acceptLabel)]}>
      {props.busy ? <ProgressView /> : <Image systemName="checkmark" />}
    </Button>
  </HStack></Host>;
}

import { HorizontalDivider, Host, IconButton, OutlinedTextField, RNHostView, Shape, Text as ComposeText, useMaterialColors, useNativeState, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText, usePreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { rawSplitBalance, rawSplitNetLabel, rawSplitSourceSummary, rawSplitWasteWidthLabel, rawSplitWidthSummary } from './rawSplitHomePresentation';
import type { RawSplitHomeViewProps } from './rawSplitHomeViewTypes';
import { useRawSplitWriteHoldText } from './useRawSplitWriteHoldText';

function Input({ label, value, enabled, onChange, decimal = false, onDone, search = false, multiline = false, error = false, onFocus, trailing }: {
  label: string; value: string; enabled: boolean; onChange: (value: string) => void; decimal?: boolean; onDone?: () => void;
  search?: boolean; multiline?: boolean; error?: boolean; onFocus?: (field: TextFieldRef) => void; trailing?: ReactNode }) {
  const native = useNativeState(value), field = useRef<TextFieldRef>(null), colors = useMaterialColors(), { mode } = useBaseTheme();
  const fill = mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest;
  const shape = Shape.RoundedCorner({ cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 } });
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField ref={field} value={native} enabled={enabled} shape={shape}
    colors={{ focusedContainerColor: fill, unfocusedContainerColor: fill, disabledContainerColor: fill, errorContainerColor: fill,
      focusedTextColor: colors.onSurface, unfocusedTextColor: colors.onSurface,
      focusedLabelColor: colors.primary, unfocusedLabelColor: colors.onSurfaceVariant,
      focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant }}
    textStyle={{ fontSize: 16 }}
    onFocusChanged={focused => { if (focused && field.current) onFocus?.(field.current); }}
    singleLine={!multiline} minLines={multiline ? 2 : undefined} maxLines={multiline ? 3 : undefined} maxLength={multiline ? 1000 : undefined}
    isError={error} onValueChange={onChange} keyboardOptions={{ keyboardType: decimal ? 'decimal' : 'text', imeAction: search ? 'search' : 'done' }}
    keyboardActions={onDone ? search ? { onSearch: onDone } : { onDone } : undefined} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><ComposeText style={{ fontSize: 14 }}>{label}</ComposeText></OutlinedTextField.Label>
    {trailing && <OutlinedTextField.TrailingIcon>{trailing}</OutlinedTextField.TrailingIcon>}
  </OutlinedTextField></Host>;
}

function SmallText({ children, center = false }: { children: string; center?: boolean }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><ComposeText color={colors.onSurfaceVariant}
    style={{ typography: 'bodySmall', fontSize: 12, ...(center ? { textAlign: 'center' as const } : {}) }} modifiers={[fillMaxWidth()]}>{children}</ComposeText></Host>;
}
function SectionDivider() {
  const colors = useMaterialColors();
  return <View style={{ height: 32, justifyContent: 'center' }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <HorizontalDivider color={colors.outlineVariant} thickness={1} modifiers={[fillMaxWidth()]} />
  </Host></View>;
}
// @v2 RawMaterialSplitScreen
export function RawSplitHome({ controller, onScan, issueRevision = 0 }: RawSplitHomeViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), colors = useMaterialColors(), t = usePreparationText();
  // V2 starts the first reload in initState, before the initial frame.
  useLayoutEffect(() => { if (controller.getSnapshot().pendingCheck === 'unread') void controller.reload(); }, [controller]);
  const writeHoldText = useRawSplitWriteHoldText();
  const locked = controller.locked, writesHeld = controller.writesHeld, plan = controller.widthPlan, check = controller.wasteCheck, source = state.source;
  const focusedInput = useRef<TextFieldRef | null>(null);
  const focusInput = (field: TextFieldRef) => { focusedInput.current = field; };
  const dismissInput = () => { void focusedInput.current?.blur(); };
  const widthLabel = plan ? rawSplitWasteWidthLabel(plan) : null;
  const issueVisible = !!(source && plan && state.showIssue && check && check.kind !== null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), handledIssue = useRef(0);
  const [issueLayout, setIssueLayout] = useState<{ source: NonNullable<typeof source>; y: number } | null>(null);
  const issueY = issueLayout?.source === source ? issueLayout.y : null;
  useEffect(() => {
    if (!issueVisible || issueY === null || issueRevision <= handledIssue.current) return;
    const frame = requestAnimationFrame(() => {
      if (!scroll.current) return;
      handledIssue.current = issueRevision; scroll.current.scrollTo({ y: issueY, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [issueRevision, issueVisible, issueY]);
  return <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}>
    {state.error !== null && <Text style={{ color: colors.error, marginBottom: 16 }}>{state.error}</Text>}
    {writesHeld && <Text style={{ color: colors.error, marginBottom: 16 }}>{writeHoldText}</Text>}
    {state.snapshotError !== null && <Text style={{ color: colors.error, marginBottom: 16 }}>{state.snapshotError}</Text>}
    {state.pendingCheck === 'failed' && <View style={{ gap: 12, marginBottom: 24 }}><Text style={{ color: colors.error }}>{t('Xatolik yuz berdi')}</Text>
      <PreparationText>{t('Oldingi saqlash natijasini tekshiring.')}</PreparationText><PreparationText>{t('Oldingi muammo qaydi natijasini tekshiring.')}</PreparationText>
      {state.pendingCheckError !== null && <Text style={{ color: colors.error }}>{state.pendingCheckError}</Text>}
      <WorkerSheetButton label={t('Qayta urinish')} height={56} onPress={() => { void controller.recheckPending(); }} /></View>}
    {state.pendingCheck === 'ready' && state.pending !== null && <View style={{ gap: 12, marginBottom: 24 }}><PreparationText>{t('Oldingi saqlash natijasini tekshiring.')}</PreparationText>
      <WorkerSheetButton label={t('Tekshirish va chop etish')} height={56} variant="filled" disabled={state.busy || state.pendingCheck !== 'ready' || writesHeld} onPress={() => { void controller.save(true); }} /></View>}
    {state.pendingCheck === 'ready' && state.pendingIssue !== null && <View style={{ marginBottom: 24 }}><PreparationText>{t('Oldingi muammo qaydi natijasini tekshiring.')}</PreparationText>
      {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
      <WorkerSheetButton label={t('Muammo qaydini tekshirish')} height={56} disabled={state.busy || state.pendingCheck !== 'ready' || writesHeld} onPress={() => { void controller.saveIssue(true); }} /></View>}
    {writesHeld && state.pendingCheck === 'ready' && (state.pending !== null || state.pendingIssue !== null) &&
      <WorkerSheetButton label={t('Tekshirish')} height={56} disabled={state.busy} onPress={() => { void controller.recheckPending(); }} />}
    <SmallText>{t(state.snapshot === null ? 'Omborlar yuklanmoqda' : !state.snapshot.warehouses.length ? 'Ombor biriktirilmagan' :
      `Ombor: ${state.snapshot.warehouses.join(', ')}`)}</SmallText>
    <View style={{ height: 16 }} />
    <Input label="Rulon QR / shtrix-kodi" value={state.barcode} enabled={!locked} search onFocus={focusInput}
      onChange={value => controller.setBarcode(value)} onDone={() => { void controller.lookup(); }}
      trailing={<IconButton enabled={!locked} onClick={() => { void controller.lookup(); }}
        modifiers={[semantics({ contentDescription: 'Rulonni topish' }), testID('homashyo-lookup')]}><RNHostView matchContents>
          <SymbolView name={{ android: 'arrow_forward' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton>} />
    <View style={{ height: 12 }} />
    <WorkerSheetButton label={t('Skanerlash')} icon={{ android: 'qr_code_scanner' }} height={56} disabled={locked} onPress={onScan} />
    {state.printer && <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SymbolView name={{ android: 'print' }} size={20} tintColor={colors.onSurfaceVariant} /><View style={{ flex: 1 }}>
        <SmallText>{t(`Printer: ${state.printer.transport}`)}</SmallText></View>
      {state.printer.transport === 'wifi' && <DropdownFilter inline label="" selectedLabel={t(state.wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')} backgroundColor={colors.surface}
        enabled={!state.busy && state.pendingCheck === 'ready'} options={[{ value: 'godex', label: t('GoDEX') }, { value: 'zebra', label: t('Zebra') }]}
        onChange={value => controller.setWifiPrinter(value)} />}
    </View>}
    {source && plan && <><SectionDivider /><PreparationText title>{source.itemName}</PreparationText>
      <View style={{ height: 4 }} /><PreparationText>{t(rawSplitSourceSummary(source))}</PreparationText>
      <SmallText>{t(`Ombor: ${source.warehouse}`)}</SmallText><View style={{ height: 16 }} />
      <PreparationText>{rawSplitWidthSummary(plan, state.outputs)}</PreparationText><View style={{ height: 8 }} />
      {state.outputs.map((output, i) => <View key={output.id ?? String(i)} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><ComposeText color={colors.onSurface} style={{ typography: 'titleSmall', fontSize: 14, fontWeight: '500' }}>{t(`${i + 1}-rulon`)}</ComposeText></Host></View>
          <Host matchContents><IconButton enabled={!locked && state.outputs.length > 1} onClick={() => controller.removeRoll(i)}
            modifiers={[semantics({ contentDescription: 'Rulonni olib tashlash' })]}><RNHostView matchContents>
              <SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host></View>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label="Eni (mm)" value={output.width} enabled={!locked}
          decimal error={plan.errors[i] !== null} onFocus={focusInput} onDone={() => { dismissInput(); controller.confirmWidth(); }} onChange={value => controller.setOutput(i, 'width', value)} /></View>
          <View style={{ flex: 1 }}><Input label="Og‘irlik (kg)" value={output.gross} enabled={!locked} decimal onFocus={focusInput} onChange={value => controller.setOutput(i, 'gross', value)} /></View></View>
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label="Babina (kg)" value={output.bobina} enabled={!locked} decimal
          onFocus={focusInput} onChange={value => controller.setOutput(i, 'bobina', value)} /></View><View style={{ flex: 1 }}><Input label="Metraj (m)" value={output.length}
          enabled={!locked} decimal onFocus={focusInput} onChange={value => controller.setOutput(i, 'length', value)} /></View></View>
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><SmallText>{rawSplitNetLabel(output)}</SmallText></View>
          <View style={{ flex: 1 }}>{i === state.outputs.length - 1 && plan.canAdd && <WorkerSheetButton label={t('+ rulon')} height={24} variant="filled" disabled={locked} onPress={() => { dismissInput(); controller.addRoll(); }} />}</View></View>
      </View>)}
      <SectionDivider /><Input label="Atxot (kg) *" value={state.waste} enabled={!locked} decimal onFocus={focusInput} onChange={value => controller.setWaste(value)} />
      <View style={{ height: 16 }} />
      {state.showIssue && check?.kind !== null && check !== null && <View onLayout={event => setIssueLayout({ source, y: event.nativeEvent.layout.y })} style={{ marginBottom: 16 }}><Text style={{ color: colors.error }}>{check.message}</Text>
        <View style={{ height: 12 }} /><Input label={t('Farq sababi')} value={state.issueNote} enabled={!locked && !state.issueSaved} multiline onFocus={focusInput} onChange={value => controller.setIssueNote(value)} />
        {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
        {state.issueSaved ? <PreparationText>{t(check.waste === null ? 'Muammo saqlandi. Chop etish uchun atxot kg ni son bilan kiriting.' :
          'Muammo saqlandi. Endi chop etishingiz mumkin.')}</PreparationText> :
          <WorkerSheetButton label={t('Muammoni saqlash')} height={56} disabled={locked || writesHeld} onPress={() => { void controller.saveIssue(); }} />}</View>}
      {plan.errors.map((error, i) => error !== null && <Text key={state.outputs[i]?.id ?? i} style={{ color: colors.error, marginBottom: 8 }}>{t(`${i + 1}-rulon: ${error}`)}</Text>)}
      <PreparationText>{rawSplitBalance(source, state.outputs, state.waste)}</PreparationText><View style={{ height: 20 }} />
      {widthLabel !== null && <><SmallText center>{widthLabel}</SmallText><View style={{ height: 8 }} /></>}
      <WorkerSheetButton label={t('Saqlash va chop etish')} icon={{ android: 'print' }} height={56} variant="filled" disabled={locked || writesHeld} onPress={() => { void controller.save(); }} />
    </>}
  </ScrollView>;
}

import { Host, IconButton, OutlinedTextField, RNHostView, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText, usePreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { rawSplitBalance, rawSplitNetLabel, rawSplitSourceSummary, rawSplitWasteWidthLabel, rawSplitWidthSummary } from './rawSplitHomePresentation';
import type { RawSplitHomeViewProps } from './rawSplitHomeViewTypes';
import { useRawSplitWriteHoldText } from './useRawSplitWriteHoldText';

function Input({ label, value, enabled, onChange, decimal = false, onDone, search = false, multiline = false, error = false }: {
  label: string; value: string; enabled: boolean; onChange: (value: string) => void; decimal?: boolean; onDone?: () => void;
  search?: boolean; multiline?: boolean; error?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={native} enabled={enabled}
    singleLine={!multiline} minLines={multiline ? 2 : undefined} maxLines={multiline ? 3 : undefined} maxLength={multiline ? 1000 : undefined}
    isError={error} onValueChange={onChange} keyboardOptions={{ keyboardType: decimal ? 'decimal' : 'text', imeAction: search ? 'search' : 'done' }}
    keyboardActions={onDone ? search ? { onSearch: onDone } : { onDone } : undefined} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><ComposeText>{label}</ComposeText></OutlinedTextField.Label>
  </OutlinedTextField></Host>;
}

export function RawSplitHome({ controller, onScan, issueRevision = 0 }: RawSplitHomeViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), colors = useMaterialColors(), t = usePreparationText();
  // V2 starts the first reload in initState, before the initial frame.
  useLayoutEffect(() => { if (controller.getSnapshot().pendingCheck === 'unread') void controller.reload(); }, [controller]);
  const writeHoldText = useRawSplitWriteHoldText();
  const locked = controller.locked, writesHeld = controller.writesHeld, plan = controller.widthPlan, check = controller.wasteCheck, source = state.source;
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
  return <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120, gap: 12 }}>
    {state.error !== null && <Text style={{ color: colors.error }}>{state.error}</Text>}
    {writesHeld && <Text style={{ color: colors.error }}>{writeHoldText}</Text>}
    {state.snapshotError !== null && <Text style={{ color: colors.error }}>{state.snapshotError}</Text>}
    {state.pendingCheck === 'failed' && <><Text style={{ color: colors.error }}>{t('Xatolik yuz berdi')}</Text>
      <PreparationText>{t('Oldingi saqlash natijasini tekshiring.')}</PreparationText><PreparationText>{t('Oldingi muammo qaydi natijasini tekshiring.')}</PreparationText>
      {state.pendingCheckError !== null && <Text style={{ color: colors.error }}>{state.pendingCheckError}</Text>}
      <WorkerSheetButton label={t('Qayta urinish')} onPress={() => { void controller.recheckPending(); }} /></>}
    {state.pendingCheck === 'ready' && state.pending !== null && <><PreparationText>{t('Oldingi saqlash natijasini tekshiring.')}</PreparationText>
      <WorkerSheetButton label={t('Tekshirish va chop etish')} variant="filled" disabled={state.busy || state.pendingCheck !== 'ready' || writesHeld} onPress={() => { void controller.save(true); }} /></>}
    {state.pendingCheck === 'ready' && state.pendingIssue !== null && <><PreparationText>{t('Oldingi muammo qaydi natijasini tekshiring.')}</PreparationText>
      {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
      <WorkerSheetButton label={t('Muammo qaydini tekshirish')} disabled={state.busy || state.pendingCheck !== 'ready' || writesHeld} onPress={() => { void controller.saveIssue(true); }} /></>}
    {writesHeld && state.pendingCheck === 'ready' && (state.pending !== null || state.pendingIssue !== null) &&
      <WorkerSheetButton label={t('Tekshirish')} disabled={state.busy} onPress={() => { void controller.recheckPending(); }} />}
    <PreparationText>{t(state.snapshot === null ? 'Omborlar yuklanmoqda' : !state.snapshot.warehouses.length ? 'Ombor biriktirilmagan' :
      `Ombor: ${state.snapshot.warehouses.join(', ')}`)}</PreparationText>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Input label="Rulon QR / shtrix-kodi"
      value={state.barcode} enabled={!locked} search onChange={value => controller.setBarcode(value)} onDone={() => { void controller.lookup(); }} /></View>
      <Host matchContents><IconButton enabled={!locked} onClick={() => { void controller.lookup(); }}
        modifiers={[semantics({ contentDescription: 'Rulonni topish' }), testID('homashyo-lookup')]}><RNHostView matchContents>
          <SymbolView name={{ android: 'arrow_forward' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host></View>
    <WorkerSheetButton label={t('Skanerlash')} icon={{ android: 'qr_code_scanner' }} disabled={locked} onPress={onScan} />
    {state.printer && <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SymbolView name={{ android: 'print' }} size={20} tintColor={colors.onSurfaceVariant} /><View style={{ flex: 1 }}>
        <PreparationText>{t(`Printer: ${state.printer.transport}`)}</PreparationText></View></View>{state.printer.transport === 'wifi' &&
      <DropdownFilter label="" selectedLabel={t(state.wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')} backgroundColor={colors.surface} enabled={!state.busy && state.pendingCheck === 'ready'}
        options={[{ value: 'godex', label: t('GoDEX') }, { value: 'zebra', label: t('Zebra') }]} onChange={value => controller.setWifiPrinter(value)} />}</>}
    {source && plan && <><PreparationText title>{source.itemName}</PreparationText><PreparationText>{t(rawSplitSourceSummary(source))}</PreparationText>
      <PreparationText>{t(`Ombor: ${source.warehouse}`)}</PreparationText><PreparationText>{rawSplitWidthSummary(plan, state.outputs)}</PreparationText>
      {state.outputs.map((output, i) => <View key={output.id ?? String(i)} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><PreparationText>{t(`${i + 1}-rulon`)}</PreparationText></View>
          <Host matchContents><IconButton enabled={!locked && state.outputs.length > 1} onClick={() => controller.removeRoll(i)}
            modifiers={[semantics({ contentDescription: 'Rulonni olib tashlash' })]}><RNHostView matchContents>
              <SymbolView name={{ android: 'close' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host></View>
        <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label="Eni (mm)" value={output.width} enabled={!locked}
          decimal error={plan.errors[i] !== null} onDone={() => controller.confirmWidth()} onChange={value => controller.setOutput(i, 'width', value)} /></View>
          <View style={{ flex: 1 }}><Input label="Og‘irlik (kg)" value={output.gross} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'gross', value)} /></View></View>
        <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label="Babina (kg)" value={output.bobina} enabled={!locked} decimal
          onChange={value => controller.setOutput(i, 'bobina', value)} /></View><View style={{ flex: 1 }}><Input label="Metraj (m)" value={output.length}
          enabled={!locked} decimal onChange={value => controller.setOutput(i, 'length', value)} /></View></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><PreparationText>{rawSplitNetLabel(output)}</PreparationText></View>
          <View style={{ flex: 1 }}>{i === state.outputs.length - 1 && plan.canAdd && <WorkerSheetButton label={t('+ rulon')} variant="filled" disabled={locked} onPress={() => controller.addRoll()} />}</View></View>
      </View>)}
      <Input label="Atxot (kg) *" value={state.waste} enabled={!locked} decimal onChange={value => controller.setWaste(value)} />
      {state.showIssue && check?.kind !== null && check !== null && <View onLayout={event => setIssueLayout({ source, y: event.nativeEvent.layout.y })} style={{ gap: 12 }}><Text style={{ color: colors.error }}>{check.message}</Text>
        <Input label={t('Farq sababi')} value={state.issueNote} enabled={!locked && !state.issueSaved} multiline onChange={value => controller.setIssueNote(value)} />
        {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
        {state.issueSaved ? <PreparationText>{t(check.waste === null ? 'Muammo saqlandi. Chop etish uchun atxot kg ni son bilan kiriting.' :
          'Muammo saqlandi. Endi chop etishingiz mumkin.')}</PreparationText> :
          <WorkerSheetButton label={t('Muammoni saqlash')} disabled={locked || writesHeld} onPress={() => { void controller.saveIssue(); }} />}</View>}
      {plan.errors.map((error, i) => error !== null && <Text key={state.outputs[i]?.id ?? i} style={{ color: colors.error }}>{t(`${i + 1}-rulon: ${error}`)}</Text>)}
      <PreparationText>{rawSplitBalance(source, state.outputs, state.waste)}</PreparationText>{widthLabel !== null && <PreparationText>{widthLabel}</PreparationText>}
      <WorkerSheetButton label={t('Saqlash va chop etish')} icon={{ android: 'print' }} variant="filled" disabled={locked || writesHeld} onPress={() => { void controller.save(); }} />
    </>}
  </ScrollView>;
}

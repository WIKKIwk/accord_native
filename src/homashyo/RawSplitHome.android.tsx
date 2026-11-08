import { Host, IconButton, OutlinedTextField, RNHostView, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { rawSplitBalance, rawSplitNetLabel, rawSplitSourceSummary, rawSplitWasteWidthLabel, rawSplitWidthSummary } from './rawSplitHomePresentation';
import type { RawSplitHomeViewProps } from './rawSplitHomeViewTypes';

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

export function RawSplitHome({ controller, onScan }: RawSplitHomeViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), colors = useMaterialColors();
  useEffect(() => { void controller.reload(); }, [controller]);
  const locked = controller.locked, plan = controller.widthPlan, check = controller.wasteCheck, source = state.source;
  const widthLabel = plan ? rawSplitWasteWidthLabel(plan) : null;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120, gap: 12 }}>
    {state.error !== null && <Text style={{ color: colors.error }}>{state.error}</Text>}
    {state.pending !== null && <><PreparationText>Oldingi saqlash natijasini tekshiring.</PreparationText>
      <WorkerSheetButton label="Tekshirish va chop etish" variant="filled" disabled={state.busy} onPress={() => { void controller.save(true); }} /></>}
    {state.pendingIssue !== null && <><PreparationText>Oldingi muammo qaydi natijasini tekshiring.</PreparationText>
      {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
      <WorkerSheetButton label="Muammo qaydini tekshirish" disabled={state.busy} onPress={() => { void controller.saveIssue(true); }} /></>}
    <PreparationText>{state.snapshot === null ? 'Omborlar yuklanmoqda' : !state.snapshot.warehouses.length ? 'Ombor biriktirilmagan' :
      `Ombor: ${state.snapshot.warehouses.join(', ')}`}</PreparationText>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Input label="Rulon QR / shtrix-kodi"
      value={state.barcode} enabled={!locked} search onChange={value => controller.setBarcode(value)} onDone={() => { void controller.lookup(); }} /></View>
      <Host matchContents><IconButton enabled={!locked} onClick={() => { void controller.lookup(); }}
        modifiers={[semantics({ contentDescription: 'Rulonni topish' }), testID('homashyo-lookup')]}><RNHostView matchContents>
          <SymbolView name={{ android: 'arrow_forward' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host></View>
    <WorkerSheetButton label="Skanerlash" disabled={locked} onPress={onScan} />
    {state.printer && <><PreparationText>{`Printer: ${state.printer.transport}`}</PreparationText>{state.printer.transport === 'wifi' &&
      <DropdownFilter label="" selectedLabel={state.wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra'} backgroundColor={colors.surface} enabled={!state.busy}
        options={[{ value: 'godex', label: 'GoDEX' }, { value: 'zebra', label: 'Zebra' }]} onChange={value => controller.setWifiPrinter(value)} />}</>}
    {source && plan && <><PreparationText title>{source.itemName}</PreparationText><PreparationText>{rawSplitSourceSummary(source)}</PreparationText>
      <PreparationText>{`Ombor: ${source.warehouse}`}</PreparationText><PreparationText>{rawSplitWidthSummary(plan, state.outputs)}</PreparationText>
      {state.outputs.map((output, i) => <View key={output.id ?? String(i)} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><PreparationText>{`${i + 1}-rulon`}</PreparationText></View>
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
          <View style={{ flex: 1 }}>{i === state.outputs.length - 1 && plan.canAdd && <WorkerSheetButton label="+ rulon" variant="filled" disabled={locked} onPress={() => controller.addRoll()} />}</View></View>
      </View>)}
      <Input label="Atxot (kg) *" value={state.waste} enabled={!locked} decimal onChange={value => controller.setWaste(value)} />
      {state.showIssue && check?.kind !== null && check !== null && <><Text style={{ color: colors.error }}>{check.message}</Text>
        <Input label="Farq sababi" value={state.issueNote} enabled={!locked && !state.issueSaved} multiline onChange={value => controller.setIssueNote(value)} />
        {state.issueError !== null && <Text style={{ color: colors.error }}>{state.issueError}</Text>}
        {state.issueSaved ? <PreparationText>{check.waste === null ? 'Muammo saqlandi. Chop etish uchun atxot kg ni son bilan kiriting.' :
          'Muammo saqlandi. Endi chop etishingiz mumkin.'}</PreparationText> :
          <WorkerSheetButton label="Muammoni saqlash" disabled={locked} onPress={() => { void controller.saveIssue(); }} />}</>}
      {plan.errors.map((error, i) => error !== null && <Text key={state.outputs[i]?.id ?? i} style={{ color: colors.error }}>{`${i + 1}-rulon: ${error}`}</Text>)}
      <PreparationText>{rawSplitBalance(source, state.outputs, state.waste)}</PreparationText>{widthLabel !== null && <PreparationText>{widthLabel}</PreparationText>}
      <WorkerSheetButton label="Saqlash va chop etish" variant="filled" disabled={locked} onPress={() => { void controller.save(); }} />
    </>}
  </ScrollView>;
}

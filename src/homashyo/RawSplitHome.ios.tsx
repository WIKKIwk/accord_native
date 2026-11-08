import { Button, Host, HStack, Menu, ScrollView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, frame, id, keyboardType, labelStyle, onSubmit, padding, scrollPosition, scrollTargetLayout, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePreparationText } from '../preparation/PreparationUI';
import { rawSplitBalance, rawSplitNetLabel, rawSplitSourceSummary, rawSplitWasteWidthLabel, rawSplitWidthSummary } from './rawSplitHomePresentation';
import type { RawSplitHomeViewProps } from './rawSplitHomeViewTypes';

function Input({ label, value, enabled, onChange, decimal = false, onDone, search = false, multiline = false }: { label: string; value: string;
  enabled: boolean; onChange: (value: string) => void; decimal?: boolean; onDone?: () => void; search?: boolean; multiline?: boolean }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  return <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity })]}><Text>{label}</Text>
    <TextField text={native} placeholder={label} onTextChange={onChange} axis={multiline ? 'vertical' : 'horizontal'}
      maxLength={multiline ? 1000 : undefined} modifiers={[disabled(!enabled), textFieldStyle('roundedBorder'),
        ...(decimal ? [keyboardType('decimal-pad')] : []), ...(onDone ? [submitLabel(search ? 'search' : 'done'), onSubmit(onDone)] : [])]} />
  </VStack>;
}

export function RawSplitHome({ controller, onScan, issueRevision = 0 }: RawSplitHomeViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  useEffect(() => { void controller.reload(); }, [controller]);
  const locked = controller.locked, plan = controller.widthPlan, check = controller.wasteCheck, source = state.source;
  const widthLabel = plan ? rawSplitWasteWidthLabel(plan) : null;
  const issueVisible = !!(source && plan && state.showIssue && check && check.kind !== null);
  const issueTarget = useNativeState<string | null>(null), handledIssue = useRef(0);
  useEffect(() => {
    if (!issueVisible || issueRevision <= handledIssue.current) return;
    issueTarget.set(null);
    const frame = requestAnimationFrame(() => { handledIssue.current = issueRevision; issueTarget.set('raw-split-issue'); });
    return () => cancelAnimationFrame(frame);
  }, [issueRevision, issueTarget, issueVisible]);
  return <Host style={{ flex: 1 }}><ScrollView modifiers={[scrollPosition(issueTarget, { anchor: 'top' })]}><VStack alignment="leading" spacing={12} modifiers={[padding({ horizontal: 16, vertical: 20 }), scrollTargetLayout()]}>
    {state.error !== null && <Text>{state.error}</Text>}
    {state.pending !== null && <><Text>{t('Oldingi saqlash natijasini tekshiring.')}</Text>
      <Button label={t('Tekshirish va chop etish')} modifiers={[disabled(state.busy), buttonStyle('borderedProminent')]} onPress={() => { void controller.save(true); }} /></>}
    {state.pendingIssue !== null && <><Text>{t('Oldingi muammo qaydi natijasini tekshiring.')}</Text>
      {state.issueError !== null && <Text>{state.issueError}</Text>}
      <Button label={t('Muammo qaydini tekshirish')} modifiers={[disabled(state.busy), buttonStyle('bordered')]} onPress={() => { void controller.saveIssue(true); }} /></>}
    <Text>{t(state.snapshot === null ? 'Omborlar yuklanmoqda' : !state.snapshot.warehouses.length ? 'Ombor biriktirilmagan' :
      `Ombor: ${state.snapshot.warehouses.join(', ')}`)}</Text>
    <HStack alignment="bottom" spacing={8}><Input label="Rulon QR / shtrix-kodi" value={state.barcode} enabled={!locked} search
      onChange={value => controller.setBarcode(value)} onDone={() => { void controller.lookup(); }} />
      <Button label="Rulonni topish" systemImage="arrow.forward" modifiers={[labelStyle('iconOnly'), accessibilityLabel('Rulonni topish'), disabled(locked)]}
        onPress={() => { void controller.lookup(); }} /></HStack>
    <Button label={t('Skanerlash')} systemImage="qrcode.viewfinder" modifiers={[disabled(locked), buttonStyle('bordered')]} onPress={onScan} />
    {state.printer && <HStack spacing={8}><Text>{t(`Printer: ${state.printer.transport}`)}</Text>{state.printer.transport === 'wifi' &&
      <Menu label={t(state.wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')}><Button label={t('GoDEX')} modifiers={[disabled(state.busy)]} onPress={() => controller.setWifiPrinter('godex')} />
        <Button label={t('Zebra')} modifiers={[disabled(state.busy)]} onPress={() => controller.setWifiPrinter('zebra')} /></Menu>}</HStack>}
    {source && plan && <><Text>{source.itemName}</Text><Text>{t(rawSplitSourceSummary(source))}</Text><Text>{t(`Ombor: ${source.warehouse}`)}</Text>
      <Text>{rawSplitWidthSummary(plan, state.outputs)}</Text>
      {state.outputs.map((output, i) => <VStack key={output.id ?? String(i)} alignment="leading" spacing={8}>
        <HStack><Text>{t(`${i + 1}-rulon`)}</Text><Button label="Rulonni olib tashlash" systemImage="xmark" modifiers={[labelStyle('iconOnly'),
          accessibilityLabel('Rulonni olib tashlash'), disabled(locked || state.outputs.length <= 1)]} onPress={() => controller.removeRoll(i)} /></HStack>
        <HStack spacing={12}><Input label="Eni (mm)" value={output.width} enabled={!locked} decimal onDone={() => controller.confirmWidth()}
          onChange={value => controller.setOutput(i, 'width', value)} />
          <Input label="Og‘irlik (kg)" value={output.gross} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'gross', value)} /></HStack>
        <HStack spacing={12}><Input label="Babina (kg)" value={output.bobina} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'bobina', value)} />
          <Input label="Metraj (m)" value={output.length} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'length', value)} /></HStack>
        <HStack spacing={12}><Text>{rawSplitNetLabel(output)}</Text>{i === state.outputs.length - 1 && plan.canAdd &&
          <Button label={t('+ rulon')} modifiers={[disabled(locked), buttonStyle('borderedProminent')]} onPress={() => controller.addRoll()} />}</HStack>
      </VStack>)}
      <Input label="Atxot (kg) *" value={state.waste} enabled={!locked} decimal onChange={value => controller.setWaste(value)} />
      {state.showIssue && check?.kind !== null && check !== null && <VStack alignment="leading" spacing={8} modifiers={[id('raw-split-issue')]}><Text>{check.message}</Text>
        <Input label={t('Farq sababi')} value={state.issueNote} enabled={!locked && !state.issueSaved} multiline onChange={value => controller.setIssueNote(value)} />
        {state.issueError !== null && <Text>{state.issueError}</Text>}
        {state.issueSaved ? <Text>{t(check.waste === null ? 'Muammo saqlandi. Chop etish uchun atxot kg ni son bilan kiriting.' :
          'Muammo saqlandi. Endi chop etishingiz mumkin.')}</Text> :
          <Button label={t('Muammoni saqlash')} modifiers={[disabled(locked), buttonStyle('bordered')]} onPress={() => { void controller.saveIssue(); }} />}</VStack>}
      {plan.errors.map((error, i) => error !== null && <Text key={state.outputs[i]?.id ?? i}>{t(`${i + 1}-rulon: ${error}`)}</Text>)}
      <Text>{rawSplitBalance(source, state.outputs, state.waste)}</Text>{widthLabel !== null && <Text>{widthLabel}</Text>}
      <Button label={t('Saqlash va chop etish')} systemImage="printer" modifiers={[disabled(locked), buttonStyle('borderedProminent')]}
        onPress={() => { void controller.save(); }} />
    </>}
  </VStack></ScrollView></Host>;
}

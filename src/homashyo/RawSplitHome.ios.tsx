import { Button, Divider, Host, HStack, Image, Menu, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, font, foregroundStyle, frame, keyboardType, labelStyle, lineLimit, onGeometryChange, onSubmit, padding, strokeBorder, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { PlatformColor, ScrollView } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { rawSplitBalance, rawSplitNetLabel, rawSplitSourceSummary, rawSplitWasteWidthLabel, rawSplitWidthSummary } from './rawSplitHomePresentation';
import type { RawSplitHomeViewProps } from './rawSplitHomeViewTypes';
import { useRawSplitIssueScroll } from './useRawSplitIssueScroll.ios';
import { useRawSplitWriteHoldText } from './useRawSplitWriteHoldText';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const fullWidth = () => frame({ maxWidth: Infinity, alignment: 'leading' });
const gap = (height: number) => <Spacer minLength={0} modifiers={[frame({ height })]} />;
const actionLabel = (label: string, icon?: 'qrcode.viewfinder' | 'printer') => <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
  {icon && <Image systemName={icon} size={18} />}<Text>{label}</Text>
</HStack>;
function Input({ label, value, enabled, onChange, decimal = false, onDone, search = false, multiline = false, error = false, trailing }: { label: string; value: string;
  enabled: boolean; onChange: (value: string) => void; decimal?: boolean; onDone?: () => void; search?: boolean; multiline?: boolean; error?: boolean; trailing?: ReactNode }) {
  const native = useNativeState(value);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  const field = <TextField text={native} onTextChange={onChange} axis={multiline ? 'vertical' : 'horizontal'}
    maxLength={multiline ? 1000 : undefined} modifiers={[accessibilityLabel(label), disabled(!enabled), textFieldStyle(trailing ? 'plain' : 'roundedBorder'),
      frame({ maxWidth: Infinity }), ...(decimal ? [keyboardType('decimal-pad')] : []), ...(multiline ? [lineLimit({ min: 2, max: 3 })] : []),
      ...(enabled && error ? [strokeBorder({ content: PlatformColor('systemRed'), shape: 'roundedRectangle', style: { lineWidth: 1 } })] : []),
      ...(onDone ? [submitLabel(search ? 'search' : 'done'), onSubmit(onDone)] : [])]} />;
  return <VStack alignment="leading" spacing={3} modifiers={[fullWidth()]}><Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{label}</Text>
    {trailing ? <HStack spacing={8} modifiers={[padding({ leading: 12, trailing: 4, vertical: 6 }), frame({ maxWidth: Infinity, minHeight: 44 }),
      strokeBorder({ content: PlatformColor('separator'), shape: 'roundedRectangle', cornerRadius: 8, style: { lineWidth: 0.5 } })]}>{field}{trailing}</HStack> : field}
  </VStack>;
}

// @v2 RawMaterialSplitScreen
export function RawSplitHome({ controller, onScan, issueRevision = 0 }: RawSplitHomeViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  // V2 starts the first reload in initState, before the initial frame.
  useLayoutEffect(() => { if (controller.getSnapshot().pendingCheck === 'unread') void controller.reload(); }, [controller]);
  const writeHoldText = useRawSplitWriteHoldText();
  const locked = controller.locked, writesHeld = controller.writesHeld, plan = controller.widthPlan, check = controller.wasteCheck, source = state.source;
  const widthLabel = plan ? rawSplitWasteWidthLabel(plan) : null;
  const issueVisible = !!(source && plan && state.showIssue && check && check.kind !== null);
  const { scroll, measureContent, measureIssueOrigin } = useRawSplitIssueScroll(source, issueVisible, issueRevision);
  // The native RN scroll owner also supports iOS 16, where SwiftUI scrollPosition is unavailable.
  return <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="always" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ paddingBottom: 100 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 16, vertical: 20 }), fullWidth(), onGeometryChange(measureContent)]}>
    {state.error !== null && <><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{state.error}</Text>{gap(16)}</>}
    {writesHeld && <><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{writeHoldText}</Text>{gap(16)}</>}
    {state.snapshotError !== null && <><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{state.snapshotError}</Text>{gap(16)}</>}
    {state.pendingCheck === 'failed' && <VStack alignment="leading" spacing={12} modifiers={[fullWidth(), padding({ bottom: 24 })]}><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t('Xatolik yuz berdi')}</Text>
      <Text>{t('Oldingi saqlash natijasini tekshiring.')}</Text><Text>{t('Oldingi muammo qaydi natijasini tekshiring.')}</Text>
      {state.pendingCheckError !== null && <Text>{state.pendingCheckError}</Text>}
      <Button modifiers={[accessibilityLabel(t('Qayta urinish')), buttonStyle('bordered')]} onPress={() => { void controller.recheckPending(); }}>{actionLabel(t('Qayta urinish'))}</Button></VStack>}
    {state.pendingCheck === 'ready' && state.pending !== null && <><Text>{t('Oldingi saqlash natijasini tekshiring.')}</Text>{gap(12)}
      <Button modifiers={[accessibilityLabel(t('Tekshirish va chop etish')), disabled(state.busy || state.pendingCheck !== 'ready' || writesHeld), buttonStyle('borderedProminent'), controlSize('large')]} onPress={() => { void controller.save(true); }}>{actionLabel(t('Tekshirish va chop etish'))}</Button>{gap(24)}</>}
    {state.pendingCheck === 'ready' && state.pendingIssue !== null && <><Text>{t('Oldingi muammo qaydi natijasini tekshiring.')}</Text>
      {state.issueError !== null && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{state.issueError}</Text>}
      <Button modifiers={[accessibilityLabel(t('Muammo qaydini tekshirish')), disabled(state.busy || state.pendingCheck !== 'ready' || writesHeld), buttonStyle('bordered')]} onPress={() => { void controller.saveIssue(true); }}>{actionLabel(t('Muammo qaydini tekshirish'))}</Button>{gap(24)}</>}
    {writesHeld && state.pendingCheck === 'ready' && (state.pending !== null || state.pendingIssue !== null) &&
      <Button modifiers={[accessibilityLabel(t('Tekshirish')), disabled(state.busy), buttonStyle('bordered')]} onPress={() => { void controller.recheckPending(); }}>{actionLabel(t('Tekshirish'))}</Button>}
    <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{t(state.snapshot === null ? 'Omborlar yuklanmoqda' : !state.snapshot.warehouses.length ? 'Ombor biriktirilmagan' :
      `Ombor: ${state.snapshot.warehouses.join(', ')}`)}</Text>{gap(16)}
    <Input label="Rulon QR / shtrix-kodi" value={state.barcode} enabled={!locked} search
      onChange={value => controller.setBarcode(value)} onDone={() => { void controller.lookup(); }} trailing={
        <Button label="Rulonni topish" systemImage="arrow.forward" modifiers={[labelStyle('iconOnly'), accessibilityLabel('Rulonni topish'), disabled(locked), buttonStyle('plain'), frame({ minWidth: 36, minHeight: 36 })]}
          onPress={() => { void controller.lookup(); }} />} />{gap(12)}
    <Button modifiers={[accessibilityLabel(t('Skanerlash')), disabled(locked), buttonStyle('bordered'), controlSize('large')]} onPress={onScan}>{actionLabel(t('Skanerlash'), 'qrcode.viewfinder')}</Button>
    {state.printer && <>{gap(16)}<HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}><Image systemName="printer" size={20} /><Text modifiers={[font({ textStyle: 'caption' }), secondary, fullWidth()]}>{t(`Printer: ${state.printer.transport}`)}</Text>{state.printer.transport === 'wifi' &&
      <Menu label={t(state.wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')}><Button label={t('GoDEX')} modifiers={[disabled(state.busy || state.pendingCheck !== 'ready')]} onPress={() => controller.setWifiPrinter('godex')} />
        <Button label={t('Zebra')} modifiers={[disabled(state.busy || state.pendingCheck !== 'ready')]} onPress={() => controller.setWifiPrinter('zebra')} /></Menu>}</HStack></>}
    {source && plan && <><Divider modifiers={[frame({ height: 32 })]} />
      <Text modifiers={[font({ textStyle: 'headline', weight: 'medium' })]}>{source.itemName}</Text>{gap(4)}
      <Text modifiers={[font({ textStyle: 'subheadline' })]}>{t(rawSplitSourceSummary(source))}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{t(`Ombor: ${source.warehouse}`)}</Text>{gap(16)}
      <Text modifiers={[font({ textStyle: 'subheadline' })]}>{rawSplitWidthSummary(plan, state.outputs)}</Text>{gap(8)}
      {state.outputs.map((output, i) => <VStack key={output.id ?? String(i)} alignment="leading" spacing={0} modifiers={[fullWidth()]}>
        <HStack modifiers={[frame({ maxWidth: Infinity })]}><Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), fullWidth()]}>{t(`${i + 1}-rulon`)}</Text>
          <Button label="Rulonni olib tashlash" systemImage="xmark" modifiers={[labelStyle('iconOnly'), accessibilityLabel('Rulonni olib tashlash'),
            disabled(locked || state.outputs.length <= 1)]} onPress={() => controller.removeRoll(i)} /></HStack>{gap(8)}
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}><Input label="Eni (mm)" value={output.width} enabled={!locked} decimal error={plan.errors[i] !== null} onDone={() => controller.confirmWidth()}
          onChange={value => controller.setOutput(i, 'width', value)} />
          <Input label="Og‘irlik (kg)" value={output.gross} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'gross', value)} /></HStack>{gap(12)}
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}><Input label="Babina (kg)" value={output.bobina} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'bobina', value)} />
          <Input label="Metraj (m)" value={output.length} enabled={!locked} decimal onChange={value => controller.setOutput(i, 'length', value)} /></HStack>{gap(12)}
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}><Text modifiers={[font({ textStyle: 'caption' }), secondary, fullWidth()]}>{rawSplitNetLabel(output)}</Text>
          {i === state.outputs.length - 1 && plan.canAdd ? <Button modifiers={[accessibilityLabel(t('+ rulon')), disabled(locked), buttonStyle('borderedProminent'), frame({ maxWidth: Infinity })]} onPress={() => controller.addRoll()}>{actionLabel(t('+ rulon'))}</Button>
            : <Spacer minLength={0} modifiers={[frame({ maxWidth: Infinity })]} />}</HStack>{gap(20)}
      </VStack>)}
      <Divider modifiers={[frame({ height: 32 })]} /><Input label="Atxot (kg) *" value={state.waste} enabled={!locked} decimal onChange={value => controller.setWaste(value)} />{gap(16)}
      {state.showIssue && check?.kind !== null && check !== null && <VStack alignment="leading" spacing={0} modifiers={[fullWidth(), onGeometryChange(measureIssueOrigin)]}><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{check.message}</Text>{gap(12)}
        <Input label={t('Farq sababi')} value={state.issueNote} enabled={!locked && !state.issueSaved} multiline onChange={value => controller.setIssueNote(value)} />
        {state.issueError !== null && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{state.issueError}</Text>}
        {state.issueSaved ? <Text>{t(check.waste === null ? 'Muammo saqlandi. Chop etish uchun atxot kg ni son bilan kiriting.' :
          'Muammo saqlandi. Endi chop etishingiz mumkin.')}</Text> :
          <Button modifiers={[accessibilityLabel(t('Muammoni saqlash')), disabled(locked || writesHeld), buttonStyle('bordered')]} onPress={() => { void controller.saveIssue(); }}>{actionLabel(t('Muammoni saqlash'))}</Button>}{gap(16)}</VStack>}
      {plan.errors.map((error, i) => error !== null && <VStack key={state.outputs[i]?.id ?? i} alignment="leading" spacing={0}><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(`${i + 1}-rulon: ${error}`)}</Text>{gap(8)}</VStack>)}
      <Text modifiers={[font({ textStyle: 'subheadline' })]}>{rawSplitBalance(source, state.outputs, state.waste)}</Text>{gap(20)}
      {widthLabel !== null && <><Text modifiers={[font({ textStyle: 'caption' }), secondary, frame({ maxWidth: Infinity, alignment: 'center' })]}>{widthLabel}</Text>{gap(8)}</>}
      <Button modifiers={[accessibilityLabel(t('Saqlash va chop etish')), disabled(locked || writesHeld), buttonStyle('borderedProminent'), controlSize('large')]}
        onPress={() => { void controller.save(); }}>{actionLabel(t('Saqlash va chop etish'), 'printer')}</Button>
    </>}
  </VStack></Host></ScrollView>;
}

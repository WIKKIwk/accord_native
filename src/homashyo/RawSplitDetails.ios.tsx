import { Button, Host, HStack, Image, Menu, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, font, foregroundStyle, frame, labelStyle, padding, textSelection, background, shapes } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { useBaseTheme } from '../components/useBaseTheme';
import { usePreparationText } from '../preparation/PreparationUI';
import { rawSplitDisplay } from './rawSplitModel';
import { rawSplitHistorySubtitle, rawSplitHistoryTitle, rawSplitIssueDetailRows, rawSplitIssueFullTime, rawSplitOutputSummary, rawSplitResultDetailRows, type RawSplitDetailRow } from './rawSplitHistoryPresentation';
import type { RawSplitDetailsProps, RawSplitIssueDetailsProps } from './rawSplitDetailsTypes';

// @v2 _RawSplitDetailLine
function RawSplitDetailLine({ label, value }: RawSplitDetailRow) {
  return <HStack alignment="top" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
    <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), frame({ width: 104, alignment: 'leading' })]}>{label}</Text>
    <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{value}</Text>
  </HStack>;
}

// @v2 RawSplitDetailsSheet
export function RawSplitDetails({ result, printerLabel, showWifiSelector, wifiPrinter, onSelectPrinter, onWifiChanged,
  onReprint, onReprintAll, onError, printBlocked = false }: RawSplitDetailsProps) {
  const [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true), t = usePreparationText(), { colors } = useBaseTheme();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || printBlocked) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { if (mounted.current) onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 20, top: 12, bottom: 20 }), frame({ maxWidth: Infinity, alignment: 'leading' }), font({ textStyle: 'subheadline', size: 14 }), foregroundStyle(colors.onSurface)]}>
    <HStack alignment="top" spacing={12} modifiers={[padding({ bottom: 18 })]}><Image systemName="scissors" size={24} modifiers={[frame({ width: 44, height: 44 }), foregroundStyle(colors.onSecondaryContainer), background(colors.secondaryContainer, shapes.roundedRectangle({ cornerRadius: 12 }))]} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'title3', weight: 'heavy' }), foregroundStyle(colors.onSurface)]}>{rawSplitHistoryTitle(result)}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(colors.onSurfaceVariant)]}>{rawSplitHistorySubtitle(result)}</Text></VStack></HStack>
    <VStack alignment="leading" spacing={7} modifiers={[padding({ bottom: 15 })]}>{rawSplitResultDetailRows(result).map(row => <RawSplitDetailLine key={row.label} {...row} />)}</VStack>
    {result.outputs.map(output => <HStack key={output.stockId} alignment="top" spacing={12} modifiers={[padding({ bottom: 12 })]}>
      <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'subheadline', size: 14, weight: 'bold' }), padding({ bottom: 2 })]}>{t(rawSplitOutputSummary(output))}</Text><Text>{output.labelName}</Text>
        {output.grossKg !== null && <Text>{t(`Brutto: ${rawSplitDisplay(output.grossKg)} kg · Babina: ${rawSplitDisplay(output.bobinaKg!)} kg`)}</Text>}
        {output.lengthM !== null && !!output.lengthM && <Text>{t(`Metri: ${rawSplitDisplay(output.lengthM)} m`)}</Text>}
        <Text modifiers={[textSelection(true)]}>{output.barcode}</Text></VStack>
      <Button label="Shu rulonni qayta chop etish" systemImage="printer" modifiers={[labelStyle('iconOnly'),
        accessibilityLabel('Shu rulonni qayta chop etish'), disabled(printing || printBlocked)]} onPress={() => { void run(() => onReprint(output)); }} />
    </HStack>)}
    {printerLabel === null ? <Button modifiers={[accessibilityLabel(t('Printer tanlash')), disabled(printing || printBlocked), buttonStyle('bordered')]}
      onPress={() => { if (!printBlocked) onSelectPrinter(); }}><HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}><Image systemName="printer" size={20} /><Text>{t('Printer tanlash')}</Text></HStack></Button> : <HStack spacing={8}><Image systemName="printer" size={20} /><Text modifiers={[font({ textStyle: 'caption' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{t(`Printer: ${printerLabel}`)}</Text>{showWifiSelector &&
        <Menu label={t(wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')}><Button label={t('GoDEX')} modifiers={[disabled(printing || printBlocked)]} onPress={() => { if (!printBlocked) onWifiChanged('godex'); }} />
          <Button label={t('Zebra')} modifiers={[disabled(printing || printBlocked)]} onPress={() => { if (!printBlocked) onWifiChanged('zebra'); }} /></Menu>}</HStack>}
    <Button modifiers={[accessibilityLabel(t('Barchasini qayta chop etish')), disabled(printing || printBlocked), buttonStyle('borderedProminent'), padding({ top: 12 })]}
      onPress={() => { void run(onReprintAll); }}><HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}><Image systemName="printer" size={20} /><Text>{t('Barchasini qayta chop etish')}</Text></HStack></Button>
  </VStack></Host>;
}

// @v2 RawSplitIssueDetailsSheet
export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const t = usePreparationText(), date = rawSplitIssueFullTime(issue), { colors } = useBaseTheme();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 20, top: 12, bottom: 20 }), frame({ maxWidth: Infinity, alignment: 'leading' }), font({ textStyle: 'subheadline', size: 14 }), foregroundStyle(colors.onSurface)]}>
    <HStack alignment="top" spacing={12} modifiers={[padding({ bottom: 18 })]}><Image systemName="exclamationmark.triangle" size={24} modifiers={[frame({ width: 44, height: 44 }), foregroundStyle(colors.onSecondaryContainer), background(colors.secondaryContainer, shapes.roundedRectangle({ cornerRadius: 12 }))]} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'title3', weight: 'heavy' }), foregroundStyle(colors.onSurface)]}>{issue.source.itemName}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(colors.onSurfaceVariant)]}>{issue.check.message}</Text></VStack></HStack>
    <VStack alignment="leading" spacing={7} modifiers={[padding({ bottom: 15 })]}>{rawSplitIssueDetailRows(issue).map(row => <RawSplitDetailLine key={row.label} {...row} />)}</VStack>
    <Text>{t(`Sabab: ${issue.note}`)}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(colors.onSurfaceVariant)]}>{t(`${issue.actorName} · ${date}`)}</Text>
    <Text>{t(hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.')}</Text>
  </VStack></Host>;
}

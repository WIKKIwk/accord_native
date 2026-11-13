import { Button, Host, HStack, Image, Menu, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, font, foregroundStyle, frame, labelStyle, padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
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
  const [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true), t = usePreparationText();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || printBlocked) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { if (mounted.current) onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <Host style={{ minHeight: 400 }}><ScrollView><VStack alignment="leading" spacing={10} modifiers={[padding({ all: 20 })]}>
    <HStack alignment="top" spacing={12}><Image systemName="scissors" size={24} /><VStack alignment="leading" spacing={4}>
      <Text>{rawSplitHistoryTitle(result)}</Text><Text>{rawSplitHistorySubtitle(result)}</Text></VStack></HStack>
    {rawSplitResultDetailRows(result).map(row => <RawSplitDetailLine key={row.label} {...row} />)}
    {result.outputs.map(output => <HStack key={output.stockId} alignment="top" spacing={12}>
      <VStack alignment="leading" spacing={3}><Text>{t(rawSplitOutputSummary(output))}</Text><Text>{output.labelName}</Text>
        {output.grossKg !== null && <Text>{t(`Brutto: ${rawSplitDisplay(output.grossKg)} kg · Babina: ${rawSplitDisplay(output.bobinaKg!)} kg`)}</Text>}
        {output.lengthM !== null && !!output.lengthM && <Text>{t(`Metri: ${rawSplitDisplay(output.lengthM)} m`)}</Text>}
        <Text modifiers={[textSelection(true)]}>{output.barcode}</Text></VStack>
      <Button label="Shu rulonni qayta chop etish" systemImage="printer" modifiers={[labelStyle('iconOnly'),
        accessibilityLabel('Shu rulonni qayta chop etish'), disabled(printing || printBlocked)]} onPress={() => { void run(() => onReprint(output)); }} />
    </HStack>)}
    {printerLabel === null ? <Button label={t('Printer tanlash')} systemImage="printer" modifiers={[disabled(printing || printBlocked), buttonStyle('bordered')]}
      onPress={() => { if (!printBlocked) onSelectPrinter(); }} /> : <HStack spacing={8}><Image systemName="printer" size={20} /><Text>{t(`Printer: ${printerLabel}`)}</Text>{showWifiSelector &&
        <Menu label={t(wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')}><Button label={t('GoDEX')} modifiers={[disabled(printing || printBlocked)]} onPress={() => { if (!printBlocked) onWifiChanged('godex'); }} />
          <Button label={t('Zebra')} modifiers={[disabled(printing || printBlocked)]} onPress={() => { if (!printBlocked) onWifiChanged('zebra'); }} /></Menu>}</HStack>}
    <Button label={t('Barchasini qayta chop etish')} systemImage="printer" modifiers={[disabled(printing || printBlocked), buttonStyle('borderedProminent')]}
      onPress={() => { void run(onReprintAll); }} />
  </VStack></ScrollView></Host>;
}

// @v2 RawSplitIssueDetailsSheet
export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const t = usePreparationText(), date = rawSplitIssueFullTime(issue);
  return <Host style={{ minHeight: 300 }}><ScrollView><VStack alignment="leading" spacing={8} modifiers={[padding({ all: 20 })]}>
    <HStack alignment="top" spacing={12}><Image systemName="exclamationmark.triangle" size={24} /><VStack alignment="leading" spacing={4}>
      <Text>{issue.source.itemName}</Text><Text>{issue.check.message}</Text></VStack></HStack>
    {rawSplitIssueDetailRows(issue).map(row => <RawSplitDetailLine key={row.label} {...row} />)}
    <Text>{t(`Sabab: ${issue.note}`)}</Text><Text>{t(`${issue.actorName} · ${date}`)}</Text>
    <Text>{t(hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.')}</Text>
  </VStack></ScrollView></Host>;
}

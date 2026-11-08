import { Button, Host, HStack, Menu, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, labelStyle, padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { rawSplitDisplay } from './rawSplitModel';
import { rawSplitHistorySubtitle, rawSplitHistoryTitle, rawSplitIssueOutputSummary, rawSplitOutputSummary } from './rawSplitHistoryPresentation';
import type { RawSplitDetailsProps, RawSplitIssueDetailsProps } from './rawSplitDetailsTypes';

export function RawSplitDetails({ result, printerLabel, showWifiSelector, wifiPrinter, onSelectPrinter, onWifiChanged,
  onReprint, onReprintAll, onError }: RawSplitDetailsProps) {
  const [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <Host style={{ minHeight: 400 }}><ScrollView><VStack alignment="leading" spacing={10} modifiers={[padding({ all: 20 })]}>
    <Text>{rawSplitHistoryTitle(result)}</Text><Text>{rawSplitHistorySubtitle(result)}</Text>
    <Text>Manba QR: {result.source.barcode}</Text><Text>Ombor: {result.source.warehouse}</Text>
    {result.createdAt !== null && <Text>Vaqti: {result.createdAt}</Text>}
    {result.issueId !== null && <><Text>Farq: {result.differenceLabel}</Text><Text>Sabab: {result.issueNote ?? ''}</Text></>}
    {result.outputs.map(output => <HStack key={output.stockId} alignment="top" spacing={12}>
      <VStack alignment="leading" spacing={3}><Text>{rawSplitOutputSummary(output)}</Text><Text>{output.labelName}</Text>
        {output.grossKg !== null && <Text>Brutto: {rawSplitDisplay(output.grossKg)} kg · Babina: {rawSplitDisplay(output.bobinaKg!)} kg</Text>}
        {output.lengthM !== null && !!output.lengthM && <Text>Metri: {rawSplitDisplay(output.lengthM)} m</Text>}
        <Text modifiers={[textSelection(true)]}>{output.barcode}</Text></VStack>
      <Button label="Shu rulonni qayta chop etish" systemImage="printer" modifiers={[labelStyle('iconOnly'),
        accessibilityLabel('Shu rulonni qayta chop etish'), disabled(printing)]} onPress={() => { void run(() => onReprint(output)); }} />
    </HStack>)}
    {printerLabel === null ? <Button label="Printer tanlash" systemImage="printer" modifiers={[disabled(printing), buttonStyle('bordered')]}
      onPress={onSelectPrinter} /> : <HStack spacing={8}><Text>Printer: {printerLabel}</Text>{showWifiSelector &&
        <Menu label={wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra'}><Button label="GoDEX" modifiers={[disabled(printing)]} onPress={() => onWifiChanged('godex')} />
          <Button label="Zebra" modifiers={[disabled(printing)]} onPress={() => onWifiChanged('zebra')} /></Menu>}</HStack>}
    <Button label="Barchasini qayta chop etish" systemImage="printer" modifiers={[disabled(printing), buttonStyle('borderedProminent')]}
      onPress={() => { void run(onReprintAll); }} />
  </VStack></ScrollView></Host>;
}

export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const time = issue.createdAt, two = (n: number) => String(n).padStart(2, '0');
  const date = `${time.getFullYear()}-${two(time.getMonth() + 1)}-${two(time.getDate())} ${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}.${String(time.getMilliseconds()).padStart(3, '0')}`;
  return <Host style={{ minHeight: 300 }}><ScrollView><VStack alignment="leading" spacing={8} modifiers={[padding({ all: 20 })]}>
    <Text>{issue.source.itemName}</Text><Text>{issue.check.message}</Text><Text>QR: {issue.source.barcode}</Text>
    <Text>Asl: {rawSplitDisplay(issue.source.kg)} kg · Atxot: {issue.enteredWaste || 'kiritilmagan'} kg</Text>
    {issue.outputs.map((output, index) => <Text key={index}>{index + 1}-rulon: {rawSplitIssueOutputSummary(output)}</Text>)}
    <Text>Sabab: {issue.note}</Text><Text>{issue.actorName} · {date}</Text>
    <Text>{hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.'}</Text>
  </VStack></ScrollView></Host>;
}
